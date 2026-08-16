import { NextResponse } from "next/server";
import { z } from "zod";

import { completerCouvertures, importerLot } from "@/db/requetes/import";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";
import { FORMATS, STATUTS } from "@/lib/validation";

// Un lot de 100 livres dépasse la fenêtre par défaut sur Vercel
export const maxDuration = 60;

const schemaLigne = z.object({
  titre: z.string().trim().min(1).max(300),
  auteur: z.string().trim().max(300),
  isbn13: z.string().max(20).nullable(),
  pages: z.number().int().positive().max(50_000).nullable(),
  note: z.number().min(0).max(5).nullable(),
  statut: z.enum(STATUTS),
  serie: z.string().max(200).nullable(),
  tome: z.number().min(0).max(999).nullable(),
  avis: z.string().max(20_000).nullable(),
  editeur: z.string().max(200).nullable(),
  format: z.enum(FORMATS),
  dateAjout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  dateLecture: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  nombreLectures: z.number().int().min(0).max(1000),
});

// Plafond par requête : le client découpe et affiche sa progression, ce qui
// vaut mieux qu'un unique envoi de 800 livres qui expire sans rien dire.
const schemaLot = z.object({ lot: z.array(schemaLigne).min(1).max(100) });

export async function POST(requete: Request) {
  const v = await corpsValide(requete, schemaLot);
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();
    const resultat = await importerLot(utilisateurId, v.data.lot);
    return NextResponse.json(resultat);
  } catch (e) {
    console.error("POST /api/import", e);
    return erreur("serveur", "Import interrompu.", 500);
  }
}

/** Complète les couvertures, par vagues, après l'import. */
export async function PATCH() {
  try {
    const utilisateurId = await utilisateurCourantId();
    const r = await completerCouvertures(utilisateurId);
    return NextResponse.json(r);
  } catch (e) {
    console.error("PATCH /api/import", e);
    return erreur("serveur", "Récupération des couvertures interrompue.", 500);
  }
}
