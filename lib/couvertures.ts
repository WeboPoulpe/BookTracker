import { createHash } from "node:crypto";

/**
 * Récupération des couvertures par ISBN.
 *
 * Deux sources, et un piège commun : **une source qui ne connaît pas un
 * livre renvoie souvent une image de remplacement en HTTP 200**, plutôt
 * qu'une erreur. Google Books sert ainsi la même vignette grise pour des
 * dizaines d'ISBN. S'y fier remplirait l'étagère d'images identiques, ce qui
 * est pire que pas d'image du tout : le repli graphique du §7, lui, encode
 * au moins le genre.
 *
 * On identifie donc les images par empreinte, et on écarte celles qui se
 * répètent.
 */

export type Couverture = { isbn13: string; url: string; empreinte: string };

/**
 * Substituts déjà rencontrés, gardés en amorce.
 *
 * La détection ne repose pas sur eux — elle est faite d'abord par répétition
 * dans le lot, ce qui la rend auto-calibrante. Ils servent au cas où un lot
 * ne contiendrait qu'un seul exemplaire du substitut.
 */
const SUBSTITUTS_CONNUS = new Set([
  "ba8cd5043eed", // « image non disponible » de Google Books, 10 794 o
  "cc7313f0f2ac", // vignette vide de Google Books, 1 269 o
]);

/** En deçà, ce n'est pas une couverture mais un pixel de remplissage. */
const TAILLE_MINIMALE = 1500;

const SOURCES = [
  {
    nom: "openlibrary",
    // `default=false` : sans ce paramètre, Open Library répond 200 avec une
    // image « pas de couverture » au lieu du 404 qui nous renseigne.
    url: (isbn: string) =>
      `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  },
  {
    nom: "google",
    url: (isbn: string) =>
      `https://books.google.com/books/content?vid=ISBN${isbn}&printsec=frontcover&img=1&zoom=1`,
  },
] as const;

async function telecharger(url: string, delaiMs = 4000) {
  const minuteur = AbortSignal.timeout(delaiMs);
  const r = await fetch(url, {
    signal: minuteur,
    headers: { "User-Agent": "MaBibliotheque/0.1 (suivi de lecture personnel)" },
  });
  if (!r.ok) return null;

  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength < TAILLE_MINIMALE) return null;

  const type = r.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return null;

  return {
    octets: buf.byteLength,
    empreinte: createHash("sha1").update(buf).digest("hex").slice(0, 12),
  };
}

/** Première source qui rend une image plausible pour cet ISBN. */
async function chercher(isbn13: string): Promise<Couverture | null> {
  for (const source of SOURCES) {
    const url = source.url(isbn13);
    try {
      const image = await telecharger(url);
      if (!image) continue;
      if (SUBSTITUTS_CONNUS.has(image.empreinte)) continue;
      return { isbn13, url, empreinte: image.empreinte };
    } catch {
      // Source injoignable : on passe à la suivante. Une couverture absente
      // n'est pas un échec, le repli graphique est prévu pour ça.
    }
  }
  return null;
}

/**
 * Résout les couvertures d'un lot, en écartant les images partagées.
 *
 * C'est la répétition qui trahit le substitut : deux livres différents ne
 * peuvent pas avoir la même image au bit près. La détection s'ajuste donc
 * d'elle-même, sans dépendre d'une liste d'empreintes à maintenir.
 */
export async function resoudreCouvertures(
  isbns: string[],
  options: {
    /** Plafond de débit : Open Library coupe au-delà de 10 requêtes/seconde */
    pauseMs?: number;
    /**
     * Budget de temps, en millisecondes.
     *
     * C'est lui qui borne la vague, pas le nombre de livres : un catalogue
     * lent transforme vingt-cinq recherches en plusieurs minutes, et la
     * fonction serveur est coupée bien avant — la vague entière est alors
     * perdue, y compris les couvertures déjà trouvées. On rend donc la main
     * de nous-mêmes, en disant jusqu'où on est allé.
     */
    budgetMs?: number;
  } = {},
): Promise<{ trouvees: Couverture[]; substituts: number; examines: number }> {
  const { pauseMs = 120, budgetMs = 20_000 } = options;
  const brut: Couverture[] = [];
  const debut = Date.now();
  let examines = 0;

  for (const isbn of isbns) {
    const c = await chercher(isbn);
    examines += 1;
    if (c) brut.push(c);
    // Au moins un livre est toujours traité, sinon une vague trop lente
    // n'avancerait jamais et la boucle appelante tournerait à vide.
    if (Date.now() - debut > budgetMs) break;
    await new Promise((r) => setTimeout(r, pauseMs));
  }

  const compte = new Map<string, number>();
  for (const c of brut) compte.set(c.empreinte, (compte.get(c.empreinte) ?? 0) + 1);

  const trouvees = brut.filter((c) => compte.get(c.empreinte) === 1);

  return { trouvees, substituts: brut.length - trouvees.length, examines };
}
