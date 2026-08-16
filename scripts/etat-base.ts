/**
 * État de la base : ce que contient chaque table, et le compte utilisateur.
 *
 * Utile après une remise à zéro, pour vérifier qu'aucune ligne fille n'a
 * survécu à son parent — les cascades du schéma sont censées s'en charger,
 * encore faut-il le constater.
 *
 *   npx tsx scripts/etat-base.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../db");
  const schema = await import("../db/schema");
  const { count } = await import("drizzle-orm");

  const tables = [
    ["utilisateurs", schema.utilisateurs],
    ["livres", schema.livres],
    ["series", schema.series],
    ["lectures", schema.lectures],
    ["sessions", schema.sessions],
    ["citations", schema.citations],
    ["couvertures", schema.couvertures],
  ] as const;

  for (const [nom, table] of tables) {
    const [r] = await db.select({ n: count() }).from(table);
    console.log(`${nom.padEnd(14)} ${String(r?.n ?? 0).padStart(4)}`);
  }

  const [u] = await db.select().from(schema.utilisateurs);
  console.log(
    `\ncompte : ${u?.nom ?? "?"} · ${u?.email ?? "?"} · objectif ${u?.objectifAnnuel ?? "?"}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
