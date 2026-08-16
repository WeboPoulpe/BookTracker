/**
 * Remet la bibliothèque à zéro, en conservant le compte utilisateur.
 *
 * Utile avant un premier import Goodreads, ou pour effacer des données de
 * test. Les suppressions en cascade du schéma emportent lectures, sessions
 * et citations : il suffit de vider `livres` et `series`.
 *
 *   npx tsx scripts/vider-donnees.ts --confirmer
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

import * as schema from "../db/schema";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

async function main() {
  const utilisateurId = process.env.UTILISATEUR_LOCAL_ID ?? "local";

  const livres = await db
    .select({ id: schema.livres.id, titre: schema.livres.titre })
    .from(schema.livres)
    .where(eq(schema.livres.utilisateurId, utilisateurId));

  const series = await db
    .select({ id: schema.series.id, nom: schema.series.nom })
    .from(schema.series)
    .where(eq(schema.series.utilisateurId, utilisateurId));

  console.log(`${livres.length} livres et ${series.length} séries seraient supprimés :`);
  for (const l of livres) console.log("  ·", l.titre);

  // Une suppression irréversible ne doit jamais être le comportement par
  // défaut d'un script qu'on lance pour voir ce qu'il fait.
  if (!process.argv.includes("--confirmer")) {
    console.log("\nRien n'a été supprimé. Relance avec --confirmer pour exécuter.");
    return;
  }

  await db.delete(schema.livres).where(eq(schema.livres.utilisateurId, utilisateurId));
  await db.delete(schema.series).where(eq(schema.series.utilisateurId, utilisateurId));

  console.log("\nBibliothèque vidée. Le compte utilisateur est conservé.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
