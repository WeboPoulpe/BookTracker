/**
 * Contrôle du rapprochement de titres, utilisé par l'import Kindle.
 *
 * Le piège central est français : `normalize("NFD")` ne décompose pas les
 * ligatures, donc « sœurs » et « soeurs » ne se rejoignaient jamais.
 *
 *   npx tsx scripts/verifier-titres.ts
 */
import { memeTitre, normaliser } from "../lib/texte";

const CAS: Array<[string, string, boolean]> = [
  // Ligatures et apostrophes typographiques
  ["Les sept sœurs", "Les sept soeurs", true],
  ["L’étranger", "L'etranger", true],
  ["Cœur de pierre", "Coeur de pierre", true],
  // Sous-titre et mention d'édition
  ["Dune", "Dune : le cycle", true],
  ["Le Palais des vents", "Le Palais des vents (Les Sept Sœurs, #4)", true],
  ["Misery", "Misery", true],
  // Ce qui ne doit surtout pas s'apparier
  ["Ça", "Cassandra", false],
  ["Dune", "Dunkerque", false],
  ["Le", "Le Comte de Monte-Cristo", false],
  // Les suites prolongent le titre du premier tome : trois romans distincts
  // de Freida McFadden, que l'ancienne règle réduisait à un seul.
  ["La femme de ménage", "La Femme de ménage voit tout", false],
  ["La femme de ménage", "La Femme de ménage se marie", false],
  ["La femme de ménage", "Les secrets de la femme de ménage", false],
  ["Harry Potter", "Harry Potter Collection", false],
  // Mention d'édition : la ponctuation fait la différence
  ["Verity", "Verity- version française", true],
  ["Le chat du Dalai lama", "Le chat du Dalai lama (édition prestige)", true],
  // Titre court, mais identique
  ["Ça", "Ça", true],
];

let echecs = 0;

for (const [a, b, attendu] of CAS) {
  const obtenu = memeTitre(a, b);
  const ok = obtenu === attendu;
  if (!ok) echecs += 1;
  console.log(
    `${ok ? "✓" : "✗"} ${JSON.stringify(a).padEnd(24)} ~ ${JSON.stringify(b).padEnd(42)} → ${obtenu}`,
  );
}

console.log(`\nnormalisation : ${JSON.stringify(normaliser("Les sept sœurs"))}`);
console.log(`${CAS.length - echecs}/${CAS.length} contrôles passés.`);

if (echecs > 0) process.exitCode = 1;
