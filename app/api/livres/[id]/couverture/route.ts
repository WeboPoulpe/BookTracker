import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { couvertures, livres } from "@/db/schema";
import { erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";

type Contexte = { params: Promise<{ id: string }> };

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Plafond volontairement bas : le client redimensionne et recompresse avant
 * d'envoyer. Une image plus grosse signale que la compression a été
 * contournée, pas qu'on tient à la qualité — une couverture s'affiche au
 * mieux sur 120 px de large.
 */
const MAX_OCTETS = 400_000;

async function idDepuis(ctx: Contexte) {
  const { id } = await ctx.params;
  const n = Number.parseInt(id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PUT(requete: Request, ctx: Contexte) {
  const id = await idDepuis(ctx);
  if (!id) return erreur("id_invalide", "Identifiant de livre invalide.");

  const type = requete.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!TYPES.includes(type)) {
    return erreur(
      "type_invalide",
      "Formats acceptés : JPEG, PNG ou WebP.",
      415,
    );
  }

  try {
    const utilisateurId = await utilisateurCourantId();

    const [livre] = await db
      .select({ id: livres.id })
      .from(livres)
      .where(and(eq(livres.id, id), eq(livres.utilisateurId, utilisateurId)))
      .limit(1);

    if (!livre) return erreur("introuvable", "Livre introuvable.", 404);

    const binaire = Buffer.from(await requete.arrayBuffer());
    if (binaire.byteLength === 0) {
      return erreur("vide", "Image vide.");
    }
    if (binaire.byteLength > MAX_OCTETS) {
      return erreur(
        "trop_lourde",
        `Image trop lourde (${Math.round(binaire.byteLength / 1024)} ko, maximum ${MAX_OCTETS / 1024} ko).`,
        413,
      );
    }

    // Version aléatoire plutôt qu'un horodatage : deux remplacements dans la
    // même seconde produiraient le même ETag, et le navigateur garderait
    // l'ancienne image.
    const version = crypto.randomUUID().slice(0, 8);

    await db
      .insert(couvertures)
      .values({
        livreId: id,
        type,
        donnees: binaire.toString("base64"),
        octets: binaire.byteLength,
        version,
      })
      .onConflictDoUpdate({
        target: couvertures.livreId,
        set: {
          type,
          donnees: binaire.toString("base64"),
          octets: binaire.byteLength,
          version,
        },
      });

    // L'URL porte la version : elle change à chaque remplacement, ce qui
    // permet de servir l'image en cache immuable sans jamais la voir périmée.
    const url = `/api/couverture/${id}?v=${version}`;
    await db.update(livres).set({ couvertureUrl: url }).where(eq(livres.id, id));

    return NextResponse.json({ url, octets: binaire.byteLength });
  } catch (e) {
    console.error("PUT /api/livres/[id]/couverture", e);
    return erreur("serveur", "Envoi impossible.", 500);
  }
}

export async function DELETE(_requete: Request, ctx: Contexte) {
  const id = await idDepuis(ctx);
  if (!id) return erreur("id_invalide", "Identifiant de livre invalide.");

  try {
    const utilisateurId = await utilisateurCourantId();

    const [livre] = await db
      .select({ id: livres.id })
      .from(livres)
      .where(and(eq(livres.id, id), eq(livres.utilisateurId, utilisateurId)))
      .limit(1);

    if (!livre) return erreur("introuvable", "Livre introuvable.", 404);

    await db.delete(couvertures).where(eq(couvertures.livreId, id));
    await db
      .update(livres)
      .set({ couvertureUrl: null })
      .where(eq(livres.id, id));

    return NextResponse.json({ supprimee: true });
  } catch (e) {
    console.error("DELETE /api/livres/[id]/couverture", e);
    return erreur("serveur", "Suppression impossible.", 500);
  }
}
