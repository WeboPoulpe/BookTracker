/**
 * Vérifie l'état de la base et crée l'utilisateur local.
 * Idempotent — relançable sans effet de bord.
 *
 *   npx tsx scripts/init-db.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

import * as schema from "../db/schema";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

async function main() {
  const tables = await db.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `);
  console.log("Tables présentes :");
  for (const t of tables.rows) console.log("  ·", t.table_name);

  const id = process.env.UTILISATEUR_LOCAL_ID ?? "local";
  const email = process.env.UTILISATEUR_LOCAL_EMAIL ?? "local@localhost";

  await db
    .insert(schema.utilisateurs)
    .values({ id, email, nom: "maxence" })
    .onConflictDoNothing({ target: schema.utilisateurs.id });

  const u = await db.select().from(schema.utilisateurs);
  console.log("\nUtilisateurs :", u);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
