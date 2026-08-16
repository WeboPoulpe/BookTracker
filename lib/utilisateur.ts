import { eq } from "drizzle-orm";

import { db } from "@/db";
import { utilisateurs } from "@/db/schema";

/**
 * Identité de l'utilisateur courant.
 *
 * Tant que Google OAuth n'est pas configuré, l'app tourne en mono-utilisateur
 * sur un compte local. Toutes les requêtes passent déjà par cet identifiant,
 * donc le branchement d'Auth.js ne touchera que ce fichier.
 */

export const MODE_LOCAL = process.env.NEXT_PUBLIC_MODE_LOCAL !== "false";

export async function utilisateurCourantId(): Promise<string> {
  if (MODE_LOCAL) {
    const id = process.env.UTILISATEUR_LOCAL_ID ?? "local";
    await garantirUtilisateurLocal(id);
    return id;
  }

  // Reste à faire au branchement d'Auth.js v5 :
  //  1. `npm i next-auth@beta @auth/drizzle-adapter`
  //  2. aligner `utilisateurs` sur la forme attendue par l'adaptateur
  //     (`name`, `emailVerified`) et `auth_comptes`/`auth_sessions` sur
  //     `userId` — les tables existent déjà, seuls les noms de colonnes
  //     changent, donc une seule migration.
  //  3. remplacer ce throw par un appel à `auth()`.
  throw new Error(
    "Mode authentifié non câblé : renseigne AUTH_GOOGLE_ID/SECRET puis " +
      "implémente utilisateurCourantId(), ou repasse NEXT_PUBLIC_MODE_LOCAL à true.",
  );
}

let localGaranti = false;

/** Crée le compte local au premier accès — évite un écran d'erreur à froid. */
async function garantirUtilisateurLocal(id: string) {
  if (localGaranti) return;
  await db
    .insert(utilisateurs)
    .values({
      id,
      email: process.env.UTILISATEUR_LOCAL_EMAIL ?? "local@localhost",
      nom: process.env.UTILISATEUR_LOCAL_NOM ?? "Morgane",
    })
    .onConflictDoNothing({ target: utilisateurs.id });
  localGaranti = true;
}

export async function utilisateurCourant() {
  const id = await utilisateurCourantId();
  const [u] = await db
    .select()
    .from(utilisateurs)
    .where(eq(utilisateurs.id, id))
    .limit(1);
  return u ?? null;
}
