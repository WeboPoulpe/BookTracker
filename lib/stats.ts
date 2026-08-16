/**
 * Calculs du tableau de bord.
 *
 * Fonctions pures, sans accès base : c'est ce qui les rend testables, et le
 * §4 les veut testées unitairement. Les requêtes vivent dans db/requetes.
 */

/**
 * Série de jours consécutifs, en remontant depuis aujourd'hui.
 *
 * La série reste vivante si on a lu hier mais pas encore aujourd'hui : la
 * casser à minuit punirait quelqu'un qui n'a simplement pas encore ouvert
 * son livre du soir.
 */
export function serieDeJours(jours: string[], aujourdhui = new Date()): number {
  if (jours.length === 0) return 0;

  const uniques = new Set(jours);
  const curseur = new Date(aujourdhui);
  curseur.setHours(12, 0, 0, 0);

  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (!uniques.has(iso(curseur))) {
    curseur.setDate(curseur.getDate() - 1);
    if (!uniques.has(iso(curseur))) return 0;
  }

  let serie = 0;
  while (uniques.has(iso(curseur))) {
    serie += 1;
    curseur.setDate(curseur.getDate() - 1);
  }
  return serie;
}

/** Répartition mensuelle sur l'année en cours, index 0 = janvier. */
export function rythmeMensuel(
  dates: Array<string | null>,
  annee: number,
): number[] {
  const mois = Array<number>(12).fill(0);
  for (const d of dates) {
    if (!d) continue;
    const date = new Date(`${d}T12:00:00`);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== annee) continue;
    mois[date.getMonth()] += 1;
  }
  return mois;
}

/** Le plus fréquent, à égalité le premier rencontré. */
export function dominant(valeurs: Array<string | null>): {
  valeur: string;
  total: number;
} | null {
  const comptes = new Map<string, number>();
  for (const v of valeurs) {
    if (!v) continue;
    comptes.set(v, (comptes.get(v) ?? 0) + 1);
  }
  if (comptes.size === 0) return null;

  let meilleur: [string, number] | null = null;
  for (const entree of comptes) {
    if (!meilleur || entree[1] > meilleur[1]) meilleur = entree;
  }
  return meilleur ? { valeur: meilleur[0], total: meilleur[1] } : null;
}

export function classement(
  valeurs: Array<string | null>,
  limite = 5,
): Array<{ valeur: string; total: number }> {
  const comptes = new Map<string, number>();
  for (const v of valeurs) {
    if (!v) continue;
    comptes.set(v, (comptes.get(v) ?? 0) + 1);
  }
  return [...comptes.entries()]
    .map(([valeur, total]) => ({ valeur, total }))
    .sort((a, b) => b.total - a.total || a.valeur.localeCompare(b.valeur, "fr"))
    .slice(0, limite);
}

/**
 * Taux d'abandon : abandonnés / (lus + abandonnés).
 *
 * Les « à lire » sont exclus du dénominateur — une PAL de 200 titres jamais
 * ouverts n'est pas un taux d'abandon de 0 %, c'est une absence de données.
 */
export function tauxAbandon(lus: number, abandonnes: number): number | null {
  const termines = lus + abandonnes;
  return termines === 0 ? null : abandonnes / termines;
}

/**
 * Rythme observé en pages par jour, sur les sessions récentes.
 *
 * On travaille sur les écarts entre pages successives d'une même lecture :
 * `page_atteinte` est un compteur absolu, pas un delta.
 */
export function pagesParJour(
  sessions: Array<{ jour: string; pageAtteinte: number | null }>,
): number | null {
  const valides = sessions
    .filter((s) => s.pageAtteinte != null)
    .sort((a, b) => a.jour.localeCompare(b.jour));

  if (valides.length < 2) return null;

  const premier = valides[0];
  const dernier = valides[valides.length - 1];
  const pages = (dernier.pageAtteinte ?? 0) - (premier.pageAtteinte ?? 0);
  if (pages <= 0) return null;

  const jours = Math.max(
    1,
    Math.round(
      (new Date(`${dernier.jour}T12:00:00`).getTime() -
        new Date(`${premier.jour}T12:00:00`).getTime()) /
        86_400_000,
    ),
  );

  return pages / jours;
}
