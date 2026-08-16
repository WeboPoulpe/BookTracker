import { NextResponse } from "next/server";

import { enregistrerSession } from "@/db/requetes/mutations";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";
import { schemaSession } from "@/lib/validation";

export async function POST(requete: Request) {
  const v = await corpsValide(requete, schemaSession);
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();
    const r = await enregistrerSession(utilisateurId, v.data);
    if (!r) return erreur("introuvable", "Livre introuvable.", 404);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    console.error("POST /api/sessions", e);
    return erreur("serveur", "Enregistrement impossible.", 500);
  }
}
