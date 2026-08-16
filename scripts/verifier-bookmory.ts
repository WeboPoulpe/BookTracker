/**
 * Contrôle du parseur Bookmory sur un vrai export.
 *
 *   npx tsx scripts/verifier-bookmory.ts <chemin-du-csv>
 */
import { readFileSync } from "node:fs";

import { lireDateFr, lirePages, lirePeriode } from "../lib/bookmory";
import { genreDepuisEtiquettes } from "../lib/etiquettes";
import { analyserCsv, detecterFormat } from "../lib/import-csv";
import { decomposerTitre } from "../lib/titres";

const chemin = process.argv[2];
if (!chemin) {
  console.error("Précise le chemin du CSV.");
  process.exit(1);
}

const csv = readFileSync(chemin, "utf8");
console.log(`format détecté : ${detecterFormat(csv)}\n`);

const a = analyserCsv(csv);
console.log(
  `lignes : ${a.total} · retenues : ${a.livres.length} · rejetées : ${a.rejets.length}`,
);
console.log(`dates approchées : ${a.datesApprochees}\n`);

const parStatut = new Map<string, number>();
for (const l of a.livres) parStatut.set(l.statut, (parStatut.get(l.statut) ?? 0) + 1);
console.log("statuts :", Object.fromEntries(parStatut));

const avecPages = a.livres.filter((l) => l.pages);
const avecGenre = a.livres.filter((l) => l.genre);
const avecNote = a.livres.filter((l) => l.note != null);
const avecSerie = a.livres.filter((l) => l.serie);
const relectures = a.livres.filter((l) => (l.periodes?.length ?? 0) > 1);

console.log(
  `pages : ${avecPages.length} · genres : ${avecGenre.length} · notes : ${avecNote.length} · séries : ${avecSerie.length}`,
);

console.log(`\nséries (${avecSerie.length}) :`);
for (const l of avecSerie) console.log(`  ${l.serie} · tome ${l.tome} — ${l.titre}`);

console.log(`\ndeux historiques (${relectures.length}) :`);
for (const l of relectures) {
  console.log(`  ${l.titre} : ${l.periodes?.map((p) => `${p.debut ?? "?"}→${p.fin}`).join(" | ")}`);
}

console.log("\ngenres déduits des étiquettes :");
for (const l of avecGenre.slice(0, 8)) {
  console.log(`  ${l.titre.slice(0, 40).padEnd(42)} ${l.genre} / ${l.sousGenre ?? "—"}`);
}

console.log("\n--- contrôles unitaires ---");
const controles: Array<[string, boolean]> = [
  ["format reconnu", detecterFormat(csv) === "bookmory"],
  ["date française abrégée", lireDateFr("22 avr. 2025") === "2025-04-22"],
  ["mois accentué", lireDateFr("26 août 2020") === "2020-08-26"],
  ["février abrégé", lireDateFr("5 févr. 2021") === "2021-02-05"],
  ["mois sans point", lireDateFr("2 juin 2022") === "2022-06-02"],
  ["date ISO tolérée", lireDateFr("2022/09/19") === "2022-09-19"],
  [
    "période complète",
    lirePeriode("22 avr. 2025 ~ 1 mai 2025")?.fin === "2025-05-01",
  ],
  ["période sans fin", lirePeriode("26 août 2020 ~ ")?.fin === null],
  ["période sans début", lirePeriode(" ~ 2 juin 2022")?.debut === null],
  ["période vide", lirePeriode(" ~ ") === null],
  ["pages simples", lirePages("p. 240") === 240],
  ["pages avec fine insécable", lirePages("p. 3 342") === 3342],
  ["p. 0 rejeté", lirePages("p. 0") === null],
  [
    "série sans virgule",
    decomposerTitre("L'Héritage Malone (Cotton Malone #12)").tome === 12,
  ],
  [
    "intégrale en plage",
    decomposerTitre("La chronique des Bridgerton Tomes 5 & 6 (Bridgertons, #5-6)")
      .tome === 5,
  ],
  [
    "collection en plage",
    decomposerTitre("Harry Potter Collection (Harry Potter, #1-6)").tome === 1,
  ],
  [
    "étiquette thriller prioritaire",
    genreDepuisEtiquettes("#Thriller #Mystery #Fiction")?.cle === "thriller",
  ],
  [
    "fiction historique reconnue",
    genreDepuisEtiquettes("#HistoricalFiction #Fiction")?.cle === "historique",
  ],
  [
    "fiction seule reste contemporain",
    genreDepuisEtiquettes("#Fiction #Roman")?.cle === "contemporain",
  ],
  ["abandons repérés", parStatut.get("abandonne") === 3],
  ["pagination majoritaire", avecPages.length >= 55],
];

let echecs = 0;
for (const [nom, ok] of controles) {
  console.log(`${ok ? "✓" : "✗"} ${nom}`);
  if (!ok) echecs += 1;
}

console.log(`\n${controles.length - echecs}/${controles.length} contrôles passés.`);
if (echecs > 0) process.exitCode = 1;
