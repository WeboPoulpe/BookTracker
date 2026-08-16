/**
 * Contrôle du parseur My Clippings.txt sur les formats réels des liseuses.
 *
 *   npx tsx scripts/verifier-kindle.ts
 */
import {
  analyserClippings,
  dedoublonner,
  lireMeta,
  separerTitreAuteur,
} from "../lib/kindle";

// Fichier réaliste : BOM initial, CRLF, français et anglais mêlés, un signet,
// une note, et un passage étendu deux fois.
const FICHIER = [
  "﻿Les sept sœurs (Riley, Lucinda)",
  "- Votre surlignement sur la page 142 | emplacement 2174-2176 | Ajouté le lundi 3 mars 2025 à 22:14:05",
  "",
  "Il y a des silences qui en disent plus long que les mots.",
  "==========",
  "Les sept sœurs (Riley, Lucinda)",
  "- Votre surlignement sur la page 142 | emplacement 2174-2178 | Ajouté le lundi 3 mars 2025 à 22:14:31",
  "",
  "Il y a des silences qui en disent plus long que les mots, et celui-là pesait une vie entière.",
  "==========",
  "Dune (Herbert, Frank)",
  "- Your Highlight on page 88 | Location 1345-1346 | Added on Tuesday, 4 March 2025 21:02:11",
  "",
  "Fear is the mind-killer.",
  "==========",
  "Les sept sœurs (Riley, Lucinda)",
  "- Votre signet sur la page 200 | emplacement 3050 | Ajouté le mardi 4 mars 2025 à 08:00:00",
  "",
  "==========",
  "L'étranger (Camus, Albert)",
  "- Votre note sur la page 12 | emplacement 180 | Ajouté le mercredi 5 mars 2025 à 07:30:00",
  "",
  "À relire en pensant à la scène du tribunal.",
  "==========",
  "Un titre sans auteur",
  "- Votre surlignement emplacement 12-14 | Ajouté le jeudi 6 mars 2025 à 09:00:00",
  "",
  "Un passage sur",
  "plusieurs lignes.",
  "==========",
].join("\r\n");

const a = analyserClippings(FICHIER);

console.log(`entrées lues : ${a.total}`);
console.log(`surlignages retenus : ${a.surlignages.length}`);
console.log(`rejets : ${JSON.stringify(a.rejets)}`);
console.log(`livres : ${a.livres.join(" · ")}\n`);

const propres = dedoublonner(a.surlignages);
console.log(`après dédoublonnage : ${propres.length}\n`);

for (const s of propres) {
  console.log(
    `[${s.type}] ${s.titre} — ${s.auteur ?? "?"} — p.${s.page ?? "?"} — ` +
      `${s.texte.slice(0, 44)}…`,
  );
}

console.log("\n--- contrôles ---");
const controles: Array<[string, boolean]> = [
  ["BOM retiré du premier titre", a.surlignages[0]?.titre === "Les sept sœurs"],
  [
    "auteur remis dans l'ordre",
    separerTitreAuteur("Les sept sœurs (Riley, Lucinda)").auteur ===
      "Lucinda Riley",
  ],
  [
    "titre à parenthèses conservé",
    separerTitreAuteur("Dune (tome 1) (Herbert, Frank)").titre ===
      "Dune (tome 1)",
  ],
  ["titre sans auteur toléré", separerTitreAuteur("Un titre").auteur === null],
  ["page française lue", lireMeta("- Votre surlignement sur la page 142 |").page === 142],
  ["page anglaise lue", lireMeta("- Your Highlight on page 88 | Location 1").page === 88],
  ["signet reconnu", lireMeta("- Votre signet sur la page 200").type === "signet"],
  ["note reconnue", lireMeta("- Votre note sur la page 12").type === "note"],
  [
    "surlignement anglais reconnu",
    lireMeta("- Your Highlight on page 88").type === "surlignement",
  ],
  ["signet écarté", a.rejets.some((r) => r.motif === "Signet, sans texte")],
  ["note conservée", propres.some((s) => s.type === "note")],
  [
    "passage multiligne recollé",
    propres.some((s) => s.texte === "Un passage sur\nplusieurs lignes."),
  ],
  [
    "extension du surlignage dédoublonnée",
    propres.filter((s) => s.titre === "Les sept sœurs").length === 1,
  ],
  [
    "version longue conservée",
    propres.find((s) => s.titre === "Les sept sœurs")?.texte.endsWith("une vie entière.") === true,
  ],
];

let echecs = 0;
for (const [nom, ok] of controles) {
  console.log(`${ok ? "✓" : "✗"} ${nom}`);
  if (!ok) echecs += 1;
}

console.log(`\n${controles.length - echecs}/${controles.length} contrôles passés.`);
if (echecs > 0) process.exitCode = 1;
