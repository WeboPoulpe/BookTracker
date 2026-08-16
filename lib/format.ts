import type { Statut } from "@/db/schema";

/* Formatage français — centralisé pour que « 7 412 pages » s'écrive
   partout avec la même espace insécable. */

const NOMBRE = new Intl.NumberFormat("fr-FR");
const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});
const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function nombre(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return NOMBRE.format(n);
}

export function dateCourte(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(`${d}T12:00:00`) : d;
  return Number.isNaN(date.getTime()) ? "—" : DATE_COURTE.format(date);
}

export function dateLongue(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(`${d}T12:00:00`) : d;
  return Number.isNaN(date.getTime()) ? "—" : DATE_LONGUE.format(date);
}

/** « 3 h 20 » plutôt que « 200 min » : c'est ainsi qu'on parle d'un audio. */
export function duree(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function pluriel(n: number, singulier: string, pluriel?: string): string {
  const forme = n > 1 ? (pluriel ?? `${singulier}s`) : singulier;
  return `${nombre(n)} ${forme}`;
}

/* ── Statuts ─────────────────────────────────────────────────────────────── */

export const LIBELLE_STATUT: Record<Statut, string> = {
  a_lire: "À lire",
  en_cours: "En cours",
  lu: "Lu",
  abandonne: "Abandonné",
  en_pause: "En pause",
};

/** Couleur de pastille par statut, dans la palette de la charte. */
export const COULEUR_STATUT: Record<Statut, { fond: string; texte: string }> = {
  a_lire: { fond: "#E6E2EE", texte: "#4A4863" },
  en_cours: { fond: "#A8C0E8", texte: "#1E3459" },
  lu: { fond: "#BBD4C4", texte: "#1F4033" },
  abandonne: { fond: "#DCD8E4", texte: "#7D7B95" },
  en_pause: { fond: "#F6D9B8", texte: "#5C3A18" },
};

export const ORDRE_STATUTS: Statut[] = [
  "en_cours",
  "a_lire",
  "en_pause",
  "lu",
  "abandonne",
];

/* ── Progression ─────────────────────────────────────────────────────────── */

export function progression(
  atteint: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (!atteint || !total || total <= 0) return null;
  return Math.min(1, Math.max(0, atteint / total));
}

export function pourcent(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${Math.round(ratio * 100)} %`;
}

/**
 * Date de fin estimée à partir du rythme observé.
 * Renvoie null si l'échantillon est trop maigre — mieux vaut ne rien annoncer
 * qu'annoncer « fini dans 3 ans » sur la foi d'une seule session.
 */
export function finEstimee(
  pagesRestantes: number,
  pagesParJour: number,
): Date | null {
  if (pagesRestantes <= 0 || pagesParJour <= 0) return null;
  const jours = Math.ceil(pagesRestantes / pagesParJour);
  if (jours > 3650) return null;
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return d;
}

/** « il y a 3 jours », « aujourd'hui » — repère plus parlant qu'une date. */
export function depuis(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(`${d}T12:00:00`) : d;
  if (Number.isNaN(date.getTime())) return "—";

  const jours = Math.round(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (jours <= 0) return "aujourd'hui";
  if (jours === 1) return "hier";
  if (jours < 7) return `il y a ${jours} jours`;
  if (jours < 31) return `il y a ${Math.floor(jours / 7)} sem.`;
  if (jours < 365) return `il y a ${Math.floor(jours / 30)} mois`;
  return dateLongue(date);
}

/**
 * « Tome 2.5 » et non « Tome 2,5 » : les hors-séries sont numérotés à
 * l'anglo-saxonne par les éditeurs eux-mêmes, on suit l'usage plutôt que la
 * typographie française.
 */
export function libelleTome(tome: number | null | undefined): string | null {
  if (tome === null || tome === undefined) return null;
  return `Tome ${tome}`;
}
