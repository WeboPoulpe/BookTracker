/**
 * Confronte les chiffres de l'accueil à ceux de l'écran Statistiques.
 *
 * Les deux écrans doivent annoncer la même chose pour la même année. Tant
 * qu'ils reposent sur deux fonctions distinctes, rien ne le garantit — d'où
 * ce contrôle.
 *
 *   npx tsx scripts/comparer-stats.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Imports dynamiques : tsx compile en CommonJS, où les imports statiques
  // sont hissés avant l'appel à config(). db/index.ts lèverait alors une
  // erreur, DATABASE_URL n'étant pas encore chargée.
  const { tableauDeBord } = await import("../db/requetes/stats");
  const { statistiques } = await import("../db/requetes/statistiques");

  const utilisateurId = process.env.UTILISATEUR_LOCAL_ID ?? "local";
  const annee = new Date().getFullYear();

  const accueil = await tableauDeBord(utilisateurId);
  const stats = await statistiques(utilisateurId, { annee, mois: null });

  // L'accueil expose désormais l'objet `statistiques` lui-même : la
  // comparaison porte sur la même source, et devient un contrôle de
  // non-régression contre une éventuelle re-duplication du calcul.
  const lignes: Array<[string, unknown, unknown]> = [
    ["année", accueil.annee, stats.portee.annee],
    ["livres lus", accueil.stats.livresLus, stats.livresLus],
    ["pages lues", accueil.stats.pagesLues, stats.pagesLues],
    ["moyenne par mois", accueil.stats.moyenneParMois, stats.moyenneParMois],
    ["jours moyens", accueil.stats.joursMoyens, stats.joursMoyens],
    ["taux d'abandon", accueil.stats.tauxAbandon, stats.tauxAbandon],
    [
      "genre dominant",
      accueil.stats.parGenre[0]?.libelle ?? null,
      stats.parGenre[0]?.libelle ?? null,
    ],
    [
      "auteur le plus lu",
      accueil.stats.parAuteur[0]?.libelle ?? null,
      stats.parAuteur[0]?.libelle ?? null,
    ],
  ];

  let ecarts = 0;
  console.log(`Année ${annee}\n`);
  console.log(
    `${"mesure".padEnd(20)} ${"accueil".padEnd(18)} ${"statistiques".padEnd(18)}`,
  );
  for (const [nom, a, b] of lignes) {
    const ok = String(a) === String(b);
    if (!ok) ecarts += 1;
    console.log(
      `${ok ? "✓" : "✗"} ${nom.padEnd(18)} ${String(a).padEnd(18)} ${String(b).padEnd(18)}`,
    );
  }

  console.log(
    ecarts === 0
      ? "\nLes deux écrans sont d'accord."
      : `\n${ecarts} écart(s) — les écrans se contredisent.`,
  );
  if (ecarts > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
