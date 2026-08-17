import { NextResponse } from "next/server";
import { z } from "zod";

import { majLecture, supprimerLecture } from "@/db/requetes/mutations";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";

type Contexte = { params: Promise<{ id: string }> };

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `debut` accepte `null` — une lecture importée sans date de début en a une
 * légitimement vide — mais pas `fin` : une lecture close ne se rouvre pas
 * ici, c'est le statut du livre qui commande.
 */
const schema = z.object({
  debut: z.string().regex(JOUR).nullable().optional(),
  fin: z.string().regex(JOUR).optional(),
});

export async function PATCH(requete: Request, ctx: Contexte) {
  const { id } = await ctx.params;
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n) || n <= 0) {
    return erreur("id_invalide", "Identifiant de lecture invalide.");
  }

  const v = await corpsValide(requete, schema);
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();
    const r = await majLecture(utilisateurId, n, v.data);
    if (!r) return erreur("introuvable", "Lecture introuvable.", 404);
    // Une règle violée n'est pas une panne : le client affiche la raison
    // telle quelle, à côté du champ fautif.
    if (!r.ok) return erreur("regle", r.refus, 422);
    return NextResponse.json({ lecture: r.lecture });
  } catch (e) {
    console.error("PATCH /api/lectures/[id]", e);
    return erreur("serveur", "Mise à jour impossible.", 500);
  }
}

export async function DELETE(_requete: Request, ctx: Contexte) {
  const { id } = await ctx.params;
  const n = Number.parseInt(id, 10);
  if (!Number.isInteger(n) || n <= 0) {
    return erreur("id_invalide", "Identifiant de lecture invalide.");
  }

  try {
    const utilisateurId = await utilisateurCourantId();
    const r = await supprimerLecture(utilisateurId, n);
    if (!r) return erreur("introuvable", "Lecture introuvable.", 404);
    // Les sessions de cette lecture partent avec elle (cascade du schéma).
    return NextResponse.json({ supprimee: true });
  } catch (e) {
    console.error("DELETE /api/lectures/[id]", e);
    return erreur("serveur", "Suppression impossible.", 500);
  }
}
