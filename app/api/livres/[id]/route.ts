import { NextResponse } from "next/server";

import { changerStatut, majLivre, supprimerLivre } from "@/db/requetes/mutations";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";
import { schemaLivre } from "@/lib/validation";

type Contexte = { params: Promise<{ id: string }> };

async function idDepuis(ctx: Contexte) {
  const { id } = await ctx.params;
  const n = Number.parseInt(id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(requete: Request, ctx: Contexte) {
  const id = await idDepuis(ctx);
  if (!id) return erreur("id_invalide", "Identifiant de livre invalide.");

  const v = await corpsValide(requete, schemaLivre.partial());
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();

    // Le statut ne se met pas à jour comme un champ ordinaire : il ouvre ou
    // clôt une lecture. On le détourne vers changerStatut().
    const { statut, ...reste } = v.data;

    if (Object.keys(reste).length > 0) {
      const maj = await majLivre(utilisateurId, id, reste);
      if (!maj) return erreur("introuvable", "Livre introuvable.", 404);
    }

    const livre = statut
      ? await changerStatut(utilisateurId, id, statut)
      : await majLivre(utilisateurId, id, {});

    return NextResponse.json({ livre });
  } catch (e) {
    console.error("PATCH /api/livres/[id]", e);
    return erreur("serveur", "Mise à jour impossible.", 500);
  }
}

export async function DELETE(_requete: Request, ctx: Contexte) {
  const id = await idDepuis(ctx);
  if (!id) return erreur("id_invalide", "Identifiant de livre invalide.");

  try {
    const utilisateurId = await utilisateurCourantId();
    const supprime = await supprimerLivre(utilisateurId, id);
    if (!supprime) return erreur("introuvable", "Livre introuvable.", 404);
    return NextResponse.json({ supprime: true });
  } catch (e) {
    console.error("DELETE /api/livres/[id]", e);
    return erreur("serveur", "Suppression impossible.", 500);
  }
}
