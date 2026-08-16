/**
 * Liste les livres ayant plusieurs lectures terminées.
 *
 * Sert à distinguer une vraie relecture d'un doublon créé par des
 * changements de statut répétés — chaque passage à « lu » clôt une lecture.
 *
 *   npx tsx scripts/inspecter-lectures.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { asc, eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../db/schema";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
const utilisateurId = process.env.UTILISATEUR_LOCAL_ID ?? "local";

// Enveloppé dans une fonction : tsx compile ces scripts en CommonJS, où le
// `await` de premier niveau n'existe pas.
async function main() {
const lignes = await db
  .select({
    livreId: schema.livres.id,
    titre: schema.livres.titre,
    auteur: schema.livres.auteur,
    lectureId: schema.lectures.id,
    debut: schema.lectures.debut,
    fin: schema.lectures.fin,
  })
  .from(schema.lectures)
  .innerJoin(schema.livres, eq(schema.livres.id, schema.lectures.livreId))
  .where(eq(schema.livres.utilisateurId, utilisateurId))
  .orderBy(asc(schema.livres.id), asc(schema.lectures.id));

const parLivre = new Map<number, typeof lignes>();
for (const l of lignes) {
  parLivre.set(l.livreId, [...(parLivre.get(l.livreId) ?? []), l]);
}

console.log(`${lignes.length} lectures pour ${parLivre.size} livres.\n`);

let multiples = 0;
for (const [, groupe] of parLivre) {
  const terminees = groupe.filter((g) => g.fin);
  if (terminees.length <= 1) continue;
  multiples += 1;
  console.log(`${groupe[0].titre} — ${groupe[0].auteur}`);
  for (const t of terminees) {
    console.log(`   lecture ${t.lectureId} : ${t.debut ?? "?"} → ${t.fin}`);
  }
}

console.log(
  multiples === 0
    ? "Aucun livre avec plusieurs lectures terminées."
    : `\n${multiples} livre(s) avec plusieurs lectures terminées.`,
);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
