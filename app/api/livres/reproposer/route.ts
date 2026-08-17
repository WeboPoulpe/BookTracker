import { NextResponse } from "next/server";

import { reproposerFiches } from "@/db/requetes/import";
import { erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";

/**
 * Remet dans la file toutes les fiches mises de côté.
 *
 * Une action « ignorer » sans retour possible serait un piège : on met une
 * fiche de côté d'un geste, et plus rien ne rappelle qu'elle existe. Le
 * chemin inverse est global plutôt que par livre — on ne se souvient pas de
 * *quelle* fiche on a tue, seulement qu'on en a tu.
 */
export async function POST() {
  try {
    const utilisateurId = await utilisateurCourantId();
    const n = await reproposerFiches(utilisateurId);
    return NextResponse.json({ reproposees: n });
  } catch (e) {
    console.error("POST /api/livres/reproposer", e);
    return erreur("serveur", "Reprise impossible.", 500);
  }
}
