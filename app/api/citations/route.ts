import { NextResponse } from "next/server";

import { ajouterCitation } from "@/db/requetes/mutations";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";
import { schemaCitation } from "@/lib/validation";

export async function POST(requete: Request) {
  const v = await corpsValide(requete, schemaCitation);
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();
    const citation = await ajouterCitation(utilisateurId, v.data);
    if (!citation) return erreur("introuvable", "Livre introuvable.", 404);
    return NextResponse.json({ citation }, { status: 201 });
  } catch (e) {
    console.error("POST /api/citations", e);
    return erreur("serveur", "Enregistrement impossible.", 500);
  }
}
