/**
 * Dates calées sur le fuseau de la lectrice, pas sur celui du serveur.
 *
 * En local, `new Date()` suit le fuseau du poste et tout paraît juste. En
 * production, la fonction tourne en UTC : une page enregistrée à 1 h du matin
 * à Paris serait datée de la veille, et le 1ᵉʳ janvier à 00 h 30 l'accueil
 * afficherait encore l'année précédente. Ce n'est pas un détail d'affichage,
 * c'est une donnée fausse en base.
 *
 * Tout ce qui manipule « aujourd'hui » ou « maintenant » passe donc par ici.
 */

/** Surchargeable par variable d'environnement, au cas où. */
export const FUSEAU = process.env.FUSEAU_HORAIRE ?? "Europe/Paris";

// `en-CA` produit nativement le format ISO court, sans recomposition manuelle.
const JOUR = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const PARTIES = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

function partie(date: Date, type: Intl.DateTimeFormatPartTypes): number {
  const v = PARTIES.formatToParts(date).find((p) => p.type === type)?.value;
  return Number.parseInt(v ?? "0", 10);
}

/** Date du jour au format `YYYY-MM-DD`, dans le fuseau de référence. */
export function aujourdhui(maintenant = new Date()): string {
  return JOUR.format(maintenant);
}

/** Heure locale, de 0 à 23. */
export function heureLocale(maintenant = new Date()): number {
  // `hour12: false` peut rendre « 24 » à minuit selon l'environnement.
  return partie(maintenant, "hour") % 24;
}

export function anneeCourante(maintenant = new Date()): number {
  return partie(maintenant, "year");
}

/** Mois courant, de 0 à 11, pour rester homogène avec `Date.getMonth()`. */
export function moisCourant(maintenant = new Date()): number {
  return partie(maintenant, "month") - 1;
}

/** Décale une date ISO courte d'un nombre de jours, sans dérive de fuseau. */
export function decalerJours(iso: string, jours: number): string {
  // Midi UTC : assez loin des bornes pour qu'aucun décalage horaire, heure
  // d'été comprise, ne fasse basculer le résultat d'un jour.
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}
