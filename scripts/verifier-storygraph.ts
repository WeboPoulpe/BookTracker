/**
 * Contrôle du parseur StoryGraph sur un vrai export.
 *
 *   npx tsx scripts/verifier-storygraph.ts <chemin-du-csv>
 */
import { readFileSync } from "node:fs";

import { analyserCsv, detecterFormat } from "../lib/import-csv";
import { choisirAuteur, lirePeriodes } from "../lib/storygraph";
import { decomposerTitre } from "../lib/titres";

const chemin = process.argv[2];
if (!chemin) {
  console.error("Précise le chemin du CSV.");
  process.exit(1);
}

const csv = readFileSync(chemin, "utf8");

console.log(`format détecté : ${detecterFormat(csv)}\n`);

const a = analyserCsv(csv);
console.log(`lignes : ${a.total} · retenues : ${a.livres.length} · rejetées : ${a.rejets.length}`);
console.log(`dates approchées : ${a.datesApprochees} · auteurs multiples : ${a.auteursMultiples}`);
console.log(`colonnes manquantes : ${a.colonnesManquantes.join(", ") || "aucune"}\n`);

const parStatut = new Map<string, number>();
for (const l of a.livres) parStatut.set(l.statut, (parStatut.get(l.statut) ?? 0) + 1);
console.log("statuts :", Object.fromEntries(parStatut));

const parFormat = new Map<string, number>();
for (const l of a.livres) parFormat.set(l.format, (parFormat.get(l.format) ?? 0) + 1);
console.log("formats :", Object.fromEntries(parFormat));

const avecSerie = a.livres.filter((l) => l.serie);
console.log(`\nséries détectées (${avecSerie.length}) :`);
for (const l of avecSerie) console.log(`  ${l.serie} · tome ${l.tome} — ${l.titre}`);

const relectures = a.livres.filter((l) => (l.periodes?.length ?? 0) > 1);
console.log(`\nrelectures (${relectures.length}) :`);
for (const l of relectures) {
  console.log(`  ${l.titre} : ${l.periodes?.map((p) => `${p.debut ?? "?"}→${p.fin}`).join(" | ")}`);
}

const abandons = a.livres.filter((l) => l.statut === "abandonne");
console.log(`\nabandons (${abandons.length}) :`);
for (const l of abandons) console.log(`  ${l.titre}`);

const notes = a.livres.filter((l) => l.note != null).length;
const isbns = a.livres.filter((l) => l.isbn13).length;
const humeurs = a.livres.filter((l) => l.humeur).length;
const axes = a.livres.filter((l) => l.axeIntrigue != null).length;
console.log(
  `\nnotes : ${notes} · ISBN retenus : ${isbns} · humeurs : ${humeurs} · axes : ${axes}`,
);

console.log("\n--- contrôles unitaires ---");
const controles: Array<[string, boolean]> = [
  ["format reconnu", detecterFormat(csv) === "storygraph"],
  [
    "plage de dates lue",
    lirePeriodes("2026/08/05-2026/08/09").length === 1 &&
      lirePeriodes("2026/08/05-2026/08/09")[0].debut === "2026-08-05",
  ],
  ["deux lectures séparées", lirePeriodes("2024/01/31-2025/03/30, 2025/03/30").length === 2],
  ["date seule acceptée", lirePeriodes("2025/12/13").length === 1],
  ["champ vide toléré", lirePeriodes("").length === 0],
  [
    "traductrice écartée via Contributors",
    choisirAuteur("Camille de Peretti, Caroline Kepnes", "Camille de Peretti (Translator)")
      .auteur === "Caroline Kepnes",
  ],
  [
    "doublon d'auteur réduit",
    choisirAuteur("Marie-Claude Delahaye, Marie-Claude Delahaye", "").multiple === false,
  ],
  ["auteurs multiples signalés", choisirAuteur("Gisèle Pelicot, Judith Perrignon", "").multiple],
  [
    "tome français extrait",
    decomposerTitre("La chronique des Bridgerton : Tome 5&6").tome === 5,
  ],
  [
    "série française extraite",
    decomposerTitre("La Chronique des Bridgerton, Tomes 7 & 8").serie ===
      "La Chronique des Bridgerton",
  ],
  ["plage sans le mot tome", decomposerTitre("La chronique des Bridgerton 1&2").tome === 1],
  ["1984 n'est pas un tome", decomposerTitre("1984").serie === null],
  [
    "convention anglo-saxonne conservée",
    decomposerTitre("Le Palais des vents (Les Sept Sœurs, #4)").tome === 4,
  ],
  ["ASIN rejeté comme ISBN", a.livres.every((l) => !l.isbn13 || /^\d{10}(\d{3})?$/.test(l.isbn13))],
  ["abandons repérés hors Read Status", abandons.length === 3],
];

let echecs = 0;
for (const [nom, ok] of controles) {
  console.log(`${ok ? "✓" : "✗"} ${nom}`);
  if (!ok) echecs += 1;
}

console.log(`\n${controles.length - echecs}/${controles.length} contrôles passés.`);
if (echecs > 0) process.exitCode = 1;
