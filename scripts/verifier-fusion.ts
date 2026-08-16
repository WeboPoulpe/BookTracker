/**
 * Contrôle de la fusion : deux catalogues versés l'un après l'autre ne
 * doivent produire aucun doublon, et le second doit compléter le premier.
 *
 *   npx tsx scripts/verifier-fusion.ts <storygraph.csv> <bookmory.csv>
 */
import { readFileSync } from "node:fs";

import { analyserCsv } from "../lib/import-csv";

const BASE = "http://localhost:3000";

async function verser(csv: string, nom: string) {
  const a = analyserCsv(csv);
  console.log(`\n=== ${nom} (${a.format}) — ${a.livres.length} livres ===`);

  const cumul = { crees: 0, completes: 0, inchanges: 0, lecturesAjoutees: 0, echecs: 0 };

  for (let i = 0; i < a.livres.length; i += 100) {
    const r = await fetch(`${BASE}/api/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lot: a.livres.slice(i, i + 100) }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(d));
    cumul.crees += d.crees;
    cumul.completes += d.completes;
    cumul.inchanges += d.inchanges;
    cumul.lecturesAjoutees += d.lecturesAjoutees;
    cumul.echecs += d.echecs?.length ?? 0;
  }

  console.log(
    `créés ${cumul.crees} · complétés ${cumul.completes} · inchangés ${cumul.inchanges} · lectures +${cumul.lecturesAjoutees} · échecs ${cumul.echecs}`,
  );
  return cumul;
}

async function etat() {
  const r = await fetch(`${BASE}/api/export?format=json`);
  const d = await r.json();
  return d as {
    livres: Array<Record<string, unknown>>;
    lectures: unknown[];
    series: unknown[];
  };
}

async function main() {
  const [sg, bm] = [process.argv[2], process.argv[3]];
  if (!sg || !bm) {
    console.error("Précise les deux fichiers.");
    process.exit(1);
  }

  await verser(readFileSync(sg, "utf8"), "StoryGraph");
  const apres1 = await etat();
  console.log(`base : ${apres1.livres.length} livres, ${apres1.lectures.length} lectures`);

  const b = await verser(readFileSync(bm, "utf8"), "Bookmory");
  const apres2 = await etat();
  console.log(`base : ${apres2.livres.length} livres, ${apres2.lectures.length} lectures`);

  console.log("\n--- doublons ---");
  const vus = new Map<string, number>();
  for (const l of apres2.livres) {
    const cle = `${String(l.titre).toLowerCase()}|${String(l.auteur).toLowerCase()}`;
    vus.set(cle, (vus.get(cle) ?? 0) + 1);
  }
  const doublons = [...vus.entries()].filter(([, n]) => n > 1);
  for (const [cle, n] of doublons) console.log(`  ${n}× ${cle}`);
  console.log(doublons.length === 0 ? "  aucun" : `  ${doublons.length} doublon(s)`);

  console.log("\n--- enrichissement apporté par Bookmory ---");
  const avecPages = apres2.livres.filter((l) => l.pages).length;
  const avecGenre = apres2.livres.filter((l) => l.genre).length;
  const avecNote = apres2.livres.filter((l) => l.note != null).length;
  console.log(`  pagination : ${avecPages}/${apres2.livres.length}`);
  console.log(`  genre      : ${avecGenre}/${apres2.livres.length}`);
  console.log(`  note       : ${avecNote}/${apres2.livres.length}`);

  console.log("\n--- contrôles ---");
  const controles: Array<[string, boolean]> = [
    ["aucun doublon", doublons.length === 0],
    ["Bookmory a complété des livres", b.completes > 0],
    ["la pagination est venue de Bookmory", avecPages > 40],
    ["le genre est venu de Bookmory", avecGenre > 20],
    ["aucun échec", b.echecs === 0],
  ];

  let echecs = 0;
  for (const [nom, ok] of controles) {
    console.log(`${ok ? "✓" : "✗"} ${nom}`);
    if (!ok) echecs += 1;
  }
  console.log(`\n${controles.length - echecs}/${controles.length} contrôles passés.`);
  if (echecs > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
