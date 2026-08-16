import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { utilisateurs } from "@/db/schema";
import { corpsValide, erreur } from "@/lib/api";
import { utilisateurCourantId } from "@/lib/utilisateur";

const schema = z.object({
  // 0 = pas d'objectif ; au-delà de 999 par an, ce n'est plus un objectif.
  objectifAnnuel: z.coerce.number().int().min(0).max(999).optional(),
  nom: z.string().trim().max(80).optional(),
});

export async function PATCH(requete: Request) {
  const v = await corpsValide(requete, schema);
  if (!v.ok) return v.reponse;

  if (Object.keys(v.data).length === 0) {
    return erreur("vide", "Rien à modifier.");
  }

  try {
    const id = await utilisateurCourantId();
    const [maj] = await db
      .update(utilisateurs)
      .set(v.data)
      .where(eq(utilisateurs.id, id))
      .returning();

    if (!maj) return erreur("introuvable", "Utilisateur introuvable.", 404);
    return NextResponse.json({ utilisateur: maj });
  } catch (e) {
    console.error("PATCH /api/utilisateur", e);
    return erreur("serveur", "Mise à jour impossible.", 500);
  }
}
