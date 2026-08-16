import { NextResponse } from "next/server";
import { z } from "zod";

import { majCitation, supprimerCitation } from "@/db/requetes/mutations";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";

type Contexte = { params: Promise<{ id: string }> };

async function idDepuis(ctx: Contexte) {
  const { id } = await ctx.params;
  const n = Number.parseInt(id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const schema = z.object({
  texte: z.string().trim().min(1).max(5000).optional(),
  page: z.coerce.number().int().min(0).max(50_000).nullish(),
});

export async function PATCH(requete: Request, ctx: Contexte) {
  const id = await idDepuis(ctx);
  if (!id) return erreur("id_invalide", "Identifiant de citation invalide.");

  const v = await corpsValide(requete, schema);
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();
    const citation = await majCitation(utilisateurId, id, v.data);
    if (!citation) return erreur("introuvable", "Citation introuvable.", 404);
    return NextResponse.json({ citation });
  } catch (e) {
    console.error("PATCH /api/citations/[id]", e);
    return erreur("serveur", "Mise à jour impossible.", 500);
  }
}

export async function DELETE(_requete: Request, ctx: Contexte) {
  const id = await idDepuis(ctx);
  if (!id) return erreur("id_invalide", "Identifiant de citation invalide.");

  try {
    const utilisateurId = await utilisateurCourantId();
    const r = await supprimerCitation(utilisateurId, id);
    if (!r) return erreur("introuvable", "Citation introuvable.", 404);
    return NextResponse.json({ supprimee: true });
  } catch (e) {
    console.error("DELETE /api/citations/[id]", e);
    return erreur("serveur", "Suppression impossible.", 500);
  }
}
