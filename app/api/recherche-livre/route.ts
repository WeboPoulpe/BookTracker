import { NextResponse } from "next/server";

import { rechercherLivre } from "@/lib/recherche";

// Deux catalogues en parallèle, plafonnés à 6 s côté client
export const maxDuration = 15;

export async function GET(requete: Request) {
  const q = new URL(requete.url).searchParams.get("q") ?? "";

  if (q.trim().length < 2) {
    return NextResponse.json({
      resultats: [],
      sources: { openlibrary: "vide", bnf: "vide" },
      toutesEnEchec: false,
    });
  }

  try {
    const reponse = await rechercherLivre(q);
    return NextResponse.json(reponse, {
      headers: {
        // Le service worker s'appuie dessus pour resservir hors ligne
        "Cache-Control":
          "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    // Ne devrait plus arriver : rechercherLivre absorbe déjà l'échec de
    // chaque catalogue. Reste comme filet, pour que l'écran bascule sur la
    // saisie manuelle au lieu d'afficher une erreur qui bloque l'ajout.
    console.error("Recherche en échec :", e);
    return NextResponse.json(
      {
        resultats: [],
        sources: { openlibrary: "echec", bnf: "echec" },
        toutesEnEchec: true,
      },
      { status: 200 },
    );
  }
}
