/**
 * Contrôle du calage horaire.
 *
 * Simule un serveur en UTC — ce qu'est Vercel — et vérifie que les dates
 * restent celles de la lectrice. Sans ce calage, une page enregistrée à 1 h
 * du matin serait datée de la veille.
 *
 *   npx tsx scripts/verifier-fuseau.ts
 */
process.env.TZ = "UTC";

import { aujourdhui, decalerJours, heureLocale, moisCourant } from "../lib/date";

type Cas = { instant: string; jour: string; heure: number; mois: number };

// Heure d'été en France : UTC+2. Heure d'hiver : UTC+1.
const CAS: Cas[] = [
  // 1 h du matin à Paris, le 17 août — le serveur est encore au 16 en UTC
  { instant: "2026-08-16T23:00:00Z", jour: "2026-08-17", heure: 1, mois: 7 },
  // 7 h à Paris : « Bonjour », alors qu'UTC dirait encore 5 h
  { instant: "2026-08-16T05:00:00Z", jour: "2026-08-16", heure: 7, mois: 7 },
  // 13 h à Paris : « Bon après-midi », UTC dirait 11 h
  { instant: "2026-08-16T11:00:00Z", jour: "2026-08-16", heure: 13, mois: 7 },
  // Nouvel An : minuit trente à Paris, encore le 31 décembre en UTC
  { instant: "2026-12-31T23:30:00Z", jour: "2027-01-01", heure: 0, mois: 0 },
  // Heure d'hiver, UTC+1 : 00 h 30 à Paris le 15 janvier
  { instant: "2027-01-14T23:30:00Z", jour: "2027-01-15", heure: 0, mois: 0 },
];

let echecs = 0;

console.log(`TZ du processus : ${process.env.TZ}\n`);

for (const c of CAS) {
  const d = new Date(c.instant);
  const j = aujourdhui(d);
  const h = heureLocale(d);
  const m = moisCourant(d);
  const naif = d.toISOString().slice(0, 10);

  const ok = j === c.jour && h === c.heure && m === c.mois;
  if (!ok) echecs += 1;

  console.log(
    `${ok ? "✓" : "✗"} ${c.instant}  →  ${j} ${String(h).padStart(2, "0")}h  ` +
      `(sans calage : ${naif})`,
  );
}

console.log("\n--- décalage de jours ---");
const decalages: Array<[string, number, string]> = [
  ["2026-03-29", 1, "2026-03-30"], // passage à l'heure d'été
  ["2026-10-25", 1, "2026-10-26"], // retour à l'heure d'hiver
  ["2026-12-31", 1, "2027-01-01"],
  ["2026-01-01", -1, "2025-12-31"],
  ["2024-02-28", 1, "2024-02-29"], // année bissextile
];
for (const [depart, n, attendu] of decalages) {
  const obtenu = decalerJours(depart, n);
  const ok = obtenu === attendu;
  if (!ok) echecs += 1;
  console.log(`${ok ? "✓" : "✗"} ${depart} ${n >= 0 ? "+" : ""}${n} → ${obtenu}`);
}

console.log(
  echecs === 0
    ? "\nToutes les dates sont calées sur le fuseau de référence."
    : `\n${echecs} échec(s).`,
);
if (echecs > 0) process.exitCode = 1;
