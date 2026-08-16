import { NextResponse } from "next/server";

import { creerLivre } from "@/db/requetes/mutations";
import { listerLivres } from "@/db/requetes/livres";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";
import { schemaLivre, STATUTS } from "@/lib/validation";

export async function GET(requete: Request) {
  const params = new URL(requete.url).searchParams;
  const statut = params.get("statut");

  try {
    const utilisateurId = await utilisateurCourantId();
    const livres = await listerLivres(utilisateurId, {
      statut:
        statut && (STATUTS as readonly string[]).includes(statut)
          ? (statut as (typeof STATUTS)[number])
          : "tous",
      recherche: params.get("q") ?? undefined,
    });
    return NextResponse.json({ livres });
  } catch (e) {
    console.error("GET /api/livres", e);
    return erreur("serveur", "Lecture impossible.", 500);
  }
}

export async function POST(requete: Request) {
  const v = await corpsValide(requete, schemaLivre);
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();
    const livre = await creerLivre(utilisateurId, v.data);
    return NextResponse.json({ livre }, { status: 201 });
  } catch (e) {
    console.error("POST /api/livres", e);
    return erreur("serveur", "Création impossible.", 500);
  }
}
