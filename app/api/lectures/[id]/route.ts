import { NextResponse } from "next/server";

import { supprimerLecture } from "@/db/requetes/mutations";
import { erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";

type Contexte = { params: Promise<{ id: string }> };

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
