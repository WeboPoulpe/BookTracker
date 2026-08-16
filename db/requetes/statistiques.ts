import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { lectures, livres } from "@/db/schema";
import { anneeCourante, moisCourant } from "@/lib/date";
import { libelleClassement, resoudreGenre } from "@/lib/genres";

/**
 * Statistiques de lecture, sur toutes les années, une année, ou un mois.
 *
 * Une seule requête ramène les lectures terminées, tout le reste se calcule en
 * mémoire. Sur une bibliothèque personnelle — quelques centaines de lignes —
 * c'est plus rapide qu'une dizaine d'agrégations SQL, et surtout bien plus
 * facile à vérifier.
 *
 * On travaille sur les lectures et non sur les livres : une relecture compte
 * pour deux, ce qui est le sens de « livres lus cette année ».
 */

export type Portee = { annee: number | null; mois: number | null };

export type Tranche = { cle: string; libelle: string; total: number };

export type Statistiques = {
  portee: Portee;
  anneesDisponibles: number[];

  livresLus: number;
  pagesLues: number;
  /** Lectures abandonnées sur la période */
  abandons: number;
  /** abandons / (lus + abandons) ; null si rien n'a été terminé */
  tauxAbandon: number | null;
  /** Pages par livre */
  moyennePages: number | null;
  /** Livres par mois sur la période couverte */
  moyenneParMois: number | null;
  /** Jours entre le début et la fin d'une lecture */
  joursMoyens: number | null;

  parLongueur: Tranche[];
  parGenre: Tranche[];
  parFormat: Tranche[];
  parNote: Tranche[];
  parAuteur: Tranche[];

  /** Douze mois de l'année choisie, ou une entrée par année si portée globale */
  serieTemporelle: Array<{ cle: string; libelle: string; livres: number; pages: number }>;
  /** Ce que représente une colonne de la série : un mois ou une année */
  granularite: "mois" | "annee";
};

const MOIS_COURTS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/** Tranches de longueur demandées : moins de 300, 300–499, 500 et plus. */
export const LONGUEURS = [
  { cle: "0-299", libelle: "moins de 300 p.", min: 0, max: 299 },
  { cle: "300-499", libelle: "300 à 499 p.", min: 300, max: 499 },
  { cle: "500-", libelle: "500 p. et plus", min: 500, max: Number.MAX_SAFE_INTEGER },
] as const;

function compter(
  valeurs: Array<string | null>,
  limite?: number,
): Tranche[] {
  const comptes = new Map<string, number>();
  for (const v of valeurs) {
    if (!v) continue;
    comptes.set(v, (comptes.get(v) ?? 0) + 1);
  }
  const tries = [...comptes.entries()]
    .map(([cle, total]) => ({ cle, libelle: cle, total }))
    .sort((a, b) => b.total - a.total || a.libelle.localeCompare(b.libelle, "fr"));
  return limite ? tries.slice(0, limite) : tries;
}

const LIBELLE_FORMAT: Record<string, string> = {
  papier: "Papier",
  ebook: "Numérique",
  audio: "Audio",
};

export async function statistiques(
  utilisateurId: string,
  portee: Portee,
): Promise<Statistiques> {
  const lignes = await db
    .select({
      livreId: livres.id,
      debut: lectures.debut,
      fin: lectures.fin,
      abandonnee: lectures.abandonnee,
      titre: livres.titre,
      auteur: livres.auteur,
      pages: livres.pages,
      format: livres.format,
      genre: livres.genre,
      sousGenre: livres.sousGenre,
      note: livres.note,
    })
    .from(lectures)
    .innerJoin(livres, eq(livres.id, lectures.livreId))
    .where(
      and(eq(livres.utilisateurId, utilisateurId), isNotNull(lectures.fin)),
    );

  // Une lecture abandonnée n'est pas un livre lu : elle a une date de fin,
  // mais la compter fausserait la moyenne de pages autant que le total.
  const terminees = lignes.filter((l) => !l.abandonnee && l.fin);

  const anneeDe = (iso: string) => Number.parseInt(iso.slice(0, 4), 10);
  const moisDe = (iso: string) => Number.parseInt(iso.slice(5, 7), 10);

  const anneesDisponibles = [
    ...new Set(terminees.map((l) => anneeDe(l.fin!))),
  ].sort((a, b) => b - a);

  const retenues = terminees.filter((l) => {
    if (portee.annee !== null && anneeDe(l.fin!) !== portee.annee) return false;
    if (portee.mois !== null && moisDe(l.fin!) !== portee.mois) return false;
    return true;
  });

  const livresLus = retenues.length;
  const pagesLues = retenues.reduce((s, l) => s + (l.pages ?? 0), 0);

  // Les abandons de la période, exclus partout ailleurs mais nécessaires ici :
  // le taux se rapporte aux seuls livres menés à leur terme, d'une façon ou
  // d'une autre. Une pile à lire de deux cents titres jamais ouverts n'est
  // pas un taux d'abandon de 0 %, c'est une absence de données.
  const abandons = lignes.filter((l) => {
    if (!l.abandonnee || !l.fin) return false;
    if (portee.annee !== null && anneeDe(l.fin) !== portee.annee) return false;
    if (portee.mois !== null && moisDe(l.fin) !== portee.mois) return false;
    return true;
  }).length;

  const tauxAbandon =
    livresLus + abandons === 0 ? null : abandons / (livresLus + abandons);

  // Moyenne sur les seuls livres dont on connaît la pagination : diviser par
  // le total ferait chuter la moyenne à cause des livres non renseignés.
  const avecPages = retenues.filter((l) => l.pages && l.pages > 0);
  const moyennePages = avecPages.length
    ? Math.round(pagesLues / avecPages.length)
    : null;

  /* Nombre de mois réellement couverts, pour une moyenne mensuelle honnête :
     rapporter les livres de janvier à douze mois donnerait un rythme faux. */
  const moisCouverts = (() => {
    if (portee.mois !== null) return 1;
    if (portee.annee !== null) {
      // Fuseau de référence : en UTC, l'année en cours basculerait une ou
      // deux heures trop tôt, et la moyenne mensuelle avec elle.
      return portee.annee === anneeCourante() ? moisCourant() + 1 : 12;
    }
    if (anneesDisponibles.length === 0) return 0;
    const dates = terminees.map((l) => l.fin!).sort();
    const [d0, d1] = [dates[0], dates[dates.length - 1]];
    return Math.max(
      1,
      (anneeDe(d1) - anneeDe(d0)) * 12 + (moisDe(d1) - moisDe(d0)) + 1,
    );
  })();

  const moyenneParMois =
    moisCouverts > 0
      ? Math.round((livresLus / moisCouverts) * 10) / 10
      : null;

  // Durée de lecture : seules les lectures ayant un début ET une fin comptent.
  const durees = retenues
    .filter((l) => l.debut && l.fin)
    .map((l) => {
      const d = new Date(`${l.debut}T12:00:00`).getTime();
      const f = new Date(`${l.fin}T12:00:00`).getTime();
      return Math.max(0, Math.round((f - d) / 86_400_000));
    });
  const joursMoyens = durees.length
    ? Math.round(durees.reduce((s, j) => s + j, 0) / durees.length)
    : null;

  /* ── Répartitions ─────────────────────────────────────────────────────── */

  const parLongueur = LONGUEURS.map((t) => ({
    cle: t.cle,
    libelle: t.libelle,
    total: avecPages.filter((l) => l.pages! >= t.min && l.pages! <= t.max).length,
  }));

  const parGenre = compter(
    retenues.map((l) => resoudreGenre(l.genre).libelle),
  );

  const parFormat = (["papier", "ebook", "audio"] as const).map((f) => ({
    cle: f,
    libelle: LIBELLE_FORMAT[f],
    total: retenues.filter((l) => (l.format ?? "papier") === f).length,
  }));

  // Demi-étoiles, de 5 à 0,5 : l'axe porte déjà l'ordre, pas la couleur.
  const parNote = Array.from({ length: 10 }, (_, i) => {
    const valeur = 5 - i * 0.5;
    return {
      cle: String(valeur),
      libelle: valeur.toLocaleString("fr-FR"),
      total: retenues.filter((l) => l.note === valeur).length,
    };
  }).filter((t) => t.total > 0);

  const parAuteur = compter(retenues.map((l) => l.auteur), 8);

  /* ── Série temporelle ─────────────────────────────────────────────────── */

  const granularite: "mois" | "annee" =
    portee.annee === null ? "annee" : "mois";

  const serieTemporelle =
    granularite === "mois"
      ? MOIS_COURTS.map((libelle, i) => {
          // On ignore volontairement le filtre de mois : la courbe de l'année
          // reste entière, c'est elle qui situe le mois choisi.
          const duMois = terminees.filter(
            (l) => anneeDe(l.fin!) === portee.annee && moisDe(l.fin!) === i + 1,
          );
          return {
            cle: String(i + 1),
            libelle,
            livres: duMois.length,
            pages: duMois.reduce((s, l) => s + (l.pages ?? 0), 0),
          };
        })
      : // De la plus récente à la plus ancienne : sur une portée
        // pluriannuelle, l'année en cours est celle qu'on vient consulter,
        // et elle doit être sous le pouce plutôt qu'au bout du défilement.
        anneesDisponibles
          .slice()
          .sort((a, b) => b - a)
          .map((a) => {
            const delAnnee = terminees.filter((l) => anneeDe(l.fin!) === a);
            return {
              cle: String(a),
              libelle: String(a),
              livres: delAnnee.length,
              pages: delAnnee.reduce((s, l) => s + (l.pages ?? 0), 0),
            };
          });

  return {
    portee,
    anneesDisponibles,
    livresLus,
    pagesLues,
    abandons,
    tauxAbandon,
    moyennePages,
    moyenneParMois,
    joursMoyens,
    parLongueur,
    parGenre,
    parFormat,
    parNote,
    parAuteur,
    serieTemporelle,
    granularite,
  };
}

/** Regroupement fin utilisé par l'écran, exposé pour les tests. */
export { libelleClassement };
