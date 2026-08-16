import { NextResponse } from "next/server";

import { rechercher } from "@/lib/openlibrary";

export async function GET(requete: Request) {
  const q = new URL(requete.url).searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({ resultats: [] });
  }

  try {
    const resultats = await rechercher(q);
    return NextResponse.json(
      { resultats },
      {
        headers: {
          // Le service worker s'appuie dessus pour resservir hors ligne
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (e) {
    // Open Library tombe régulièrement : on renvoie une liste vide et un
    // indicateur, pour que l'écran bascule sur la saisie manuelle au lieu
    // d'afficher une erreur qui bloque l'ajout.
    console.error("Recherche Open Library en échec :", e);
    return NextResponse.json(
      { resultats: [], indisponible: true },
      { status: 200 },
    );
  }
}
