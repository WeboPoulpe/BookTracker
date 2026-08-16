"use client";

/**
 * Préparation d'une couverture avant envoi.
 *
 * Une photo prise au téléphone pèse 3 à 5 Mo pour 4000 px de large, alors
 * qu'une couverture s'affiche au mieux sur 120 px — 360 px sur un écran à
 * trois fois la densité. Redimensionner et recompresser dans le navigateur
 * évite de faire transiter cinquante fois le nécessaire, et de le stocker.
 */

/** Assez pour un affichage plein écran sur mobile haute densité. */
const LARGEUR_MAX = 600;
const HAUTEUR_MAX = 900;
const QUALITE = 0.82;

export type CouverturePreparee = {
  blob: Blob;
  /** URL d'objet pour l'aperçu — à révoquer par l'appelant */
  apercu: string;
  largeur: number;
  hauteur: number;
};

/** WebP compresse ~30 % mieux que JPEG à qualité égale. Absent de Safari <14. */
function supporteWebp(): boolean {
  const c = document.createElement("canvas");
  c.width = 1;
  c.height = 1;
  return c.toDataURL("image/webp").startsWith("data:image/webp");
}

/**
 * Décode en respectant l'orientation EXIF.
 *
 * Sans ça, une couverture photographiée en portrait s'affiche couchée : le
 * capteur enregistre en paysage et laisse un attribut d'orientation que le
 * canvas ignore.
 */
async function decoder(fichier: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(fichier, { imageOrientation: "from-image" });
    } catch {
      // Safari ancien : l'option n'existe pas, on retombe sur <img>, qui
      // applique l'orientation de lui-même depuis iOS 13.
    }
  }

  const url = URL.createObjectURL(fichier);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function preparerCouverture(
  fichier: File,
): Promise<CouverturePreparee> {
  if (!fichier.type.startsWith("image/")) {
    throw new Error("Ce fichier n'est pas une image.");
  }

  const source = await decoder(fichier);
  const largeurSource = source.width;
  const hauteurSource = source.height;

  if (!largeurSource || !hauteurSource) {
    throw new Error("Image illisible.");
  }

  // On tient dans la boîte sans déformer ni rogner : une couverture rognée
  // perd son titre, et c'est souvent tout ce qui permet de la reconnaître.
  const facteur = Math.min(
    1,
    LARGEUR_MAX / largeurSource,
    HAUTEUR_MAX / hauteurSource,
  );
  const largeur = Math.round(largeurSource * facteur);
  const hauteur = Math.round(hauteurSource * facteur);

  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Traitement d'image indisponible.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, largeur, hauteur);

  if ("close" in source) source.close();

  const type = supporteWebp() ? "image/webp" : "image/jpeg";

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, type, QUALITE),
  );
  if (!blob) throw new Error("Compression impossible.");

  return {
    blob,
    apercu: URL.createObjectURL(blob),
    largeur,
    hauteur,
  };
}

/** Envoie une couverture déjà préparée pour un livre existant. */
export async function envoyerCouverture(
  livreId: number,
  blob: Blob,
): Promise<string> {
  const r = await fetch(`/api/livres/${livreId}/couverture`, {
    method: "PUT",
    headers: { "Content-Type": blob.type },
    body: blob,
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error(data?.erreur?.message ?? "Envoi de la couverture impossible.");
  }
  return data.url as string;
}
