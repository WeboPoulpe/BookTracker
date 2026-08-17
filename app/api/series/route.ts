import { NextResponse } from "next/server";

import { listerNomsSeries } from "@/db/requetes/series";
import { erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";

/**
 * Noms des séries existantes, pour l'autocomplétion du champ « série ».
 *
 * Une route plutôt qu'une propriété passée depuis la page : l'écran d'ajout
 * est prérendu statiquement, il n'a donc aucun moyen de recevoir cette liste
 * au rendu. Le service worker met les GET d'API en cache, ce qui laisse
 * l'autocomplétion fonctionner en mode avion — c'est justement là que
 * retaper un nom de série à la main serait le plus risqué.
 */
export async function GET() {
  try {
    const utilisateurId = await utilisateurCourantId();
    const noms = await listerNomsSeries(utilisateurId);
    return NextResponse.json({ noms });
  } catch (e) {
    console.error("GET /api/series", e);
    return erreur("serveur", "Séries indisponibles.", 500);
  }
}
