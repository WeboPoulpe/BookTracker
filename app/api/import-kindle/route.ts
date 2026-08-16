import { NextResponse } from "next/server";
import { z } from "zod";

import { apparier, importerSurlignages } from "@/db/requetes/kindle";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const maxDuration = 60;

const schemaSurlignage = z.object({
  titre: z.string().trim().min(1).max(400),
  auteur: z.string().trim().max(300).nullable(),
  texte: z.string().trim().min(1).max(5000),
  page: z.number().int().min(0).max(50_000).nullable(),
  emplacement: z.string().max(40).nullable(),
  type: z.enum(["surlignement", "note"]),
});

/** Étape 1 : proposer les rapprochements, sans rien écrire. */
const schemaApparier = z.object({
  action: z.literal("apparier"),
  surlignages: z.array(schemaSurlignage).min(1).max(5000),
});

/** Étape 2 : importer ce que la lectrice a confirmé. */
const schemaImporter = z.object({
  action: z.literal("importer"),
  appariements: z
    .array(
      z.object({
        livreId: z.number().int().positive(),
        surlignages: z.array(schemaSurlignage).min(1),
      }),
    )
    .min(1)
    .max(500),
});

const schema = z.discriminatedUnion("action", [
  schemaApparier,
  schemaImporter,
]);

export async function POST(requete: Request) {
  const v = await corpsValide(requete, schema);
  if (!v.ok) return v.reponse;

  try {
    const utilisateurId = await utilisateurCourantId();

    if (v.data.action === "apparier") {
      const appariements = await apparier(utilisateurId, v.data.surlignages);
      return NextResponse.json({ appariements });
    }

    const resultat = await importerSurlignages(
      utilisateurId,
      v.data.appariements,
    );
    return NextResponse.json(resultat);
  } catch (e) {
    console.error("POST /api/import-kindle", e);
    return erreur("serveur", "Import interrompu.", 500);
  }
}
