import { NextResponse } from "next/server";
import { z } from "zod";

import { majSession, supprimerSession } from "@/db/requetes/mutations";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";

type Contexte = { params: Promise<{ id: string }> };

async function idDepuis(ctx: Contexte) {
  const { id } = await ctx.params;
  const n = Number.parseInt(id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const schema = z.object({
  jour: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pageAtteinte: z.coerce.number().int().min(0).max(50_000).nullish(),
  minutes: z.coerce.number().int().min(1).max(1440).nullish(),
  noteRapide: z.string().trim().max(500).nullish(),
});

export async function PATCH(requete: Request, ctx: Contexte) {
  const id = await idDepuis(ctx);
  if (!id) return erreur("id_invalide", "Identifiant de session invalide.");

  const v = await corpsValide(requete, schema);
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();
    const session = await majSession(utilisateurId, id, v.data);
    if (!session) return erreur("introuvable", "Session introuvable.", 404);
    return NextResponse.json({ session });
  } catch (e) {
    console.error("PATCH /api/sessions/[id]", e);
    return erreur("serveur", "Mise à jour impossible.", 500);
  }
}

export async function DELETE(_requete: Request, ctx: Contexte) {
  const id = await idDepuis(ctx);
  if (!id) return erreur("id_invalide", "Identifiant de session invalide.");

  try {
    const utilisateurId = await utilisateurCourantId();
    const r = await supprimerSession(utilisateurId, id);
    if (!r) return erreur("introuvable", "Session introuvable.", 404);
    return NextResponse.json({ supprimee: true });
  } catch (e) {
    console.error("DELETE /api/sessions/[id]", e);
    return erreur("serveur", "Suppression impossible.", 500);
  }
}
