/**
 * Contrôle du référentiel genres / sous-genres.
 *
 *   npx tsx scripts/verifier-genres.ts
 */
import { GENRES, SOUS_GENRES, sousGenresDe } from "../lib/genres";

let manquants = 0;

for (const g of GENRES) {
  const s = sousGenresDe(g.libelle);
  if (s.length === 0) manquants += 1;
  console.log(
    `${g.libelle.padEnd(22)} ${String(s.length).padStart(2)} → ${s.slice(0, 3).join(", ")}`,
  );
}

console.log("\n--- résolution tolérante ---");
for (const essai of [
  "Science-fiction",
  "science fiction",
  "POLICIER",
  "Développement perso",
  "Sans genre",
  "",
  "libellé inconnu",
]) {
  console.log(
    `${JSON.stringify(essai).padEnd(24)} → ${sousGenresDe(essai).length} suggestions`,
  );
}

const total = Object.values(SOUS_GENRES).flat().length;
console.log(
  `\n${GENRES.length} genres, ${total} sous-genres, ${manquants} genre(s) sans suggestion.`,
);

if (manquants > 0) process.exitCode = 1;
