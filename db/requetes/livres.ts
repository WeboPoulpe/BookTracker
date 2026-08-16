import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  citations,
  lectures,
  livres,
  series,
  sessions,
  type Statut,
} from "@/db/schema";

import {
  DERNIERE_SESSION,
  MINUTES_CUMULEES,
  PAGE_ATTEINTE,
} from "./expressions";

/**
 * Sous-requêtes corrélées plutôt qu'une jointure + GROUP BY : on veut une
 * ligne par livre même sans aucune session, et un GROUP BY sur 26 colonnes
 * est illisible autant qu'inutile. Définies dans expressions.ts, où le choix
 * du SQL explicite est justifié.
 */
const pageAtteinte = PAGE_ATTEINTE.as("page_atteinte");
const minutesCumulees = MINUTES_CUMULEES.as("minutes_cumulees");
const derniereSession = DERNIERE_SESSION.as("derniere_session");

const CHAMPS_LISTE = {
  id: livres.id,
  titre: livres.titre,
  auteur: livres.auteur,
  isbn13: livres.isbn13,
  couvertureUrl: livres.couvertureUrl,
  pages: livres.pages,
  dureeMinutes: livres.dureeMinutes,
  format: livres.format,
  genre: livres.genre,
  sousGenre: livres.sousGenre,
  statut: livres.statut,
  priorite: livres.priorite,
  note: livres.note,
  humeur: livres.humeur,
  emoji: livres.emoji,
  tome: livres.tome,
  serieId: livres.serieId,
  serieNom: series.nom,
  serieTomesTotal: series.tomesTotal,
  creeLe: livres.creeLe,
  pageAtteinte,
  minutesCumulees,
  derniereSession,
} as const;

export type LivreListe = Awaited<ReturnType<typeof listerLivres>>[number];

export type FiltresLivres = {
  statut?: Statut | "tous";
  recherche?: string;
  genre?: string;
  serieId?: number;
  tri?: "recent" | "titre" | "auteur" | "note";
  limite?: number;
};

export async function listerLivres(
  utilisateurId: string,
  filtres: FiltresLivres = {},
) {
  const conditions = [eq(livres.utilisateurId, utilisateurId)];

  if (filtres.statut && filtres.statut !== "tous") {
    conditions.push(eq(livres.statut, filtres.statut));
  }
  if (filtres.genre) {
    conditions.push(eq(livres.genre, filtres.genre));
  }
  if (filtres.serieId) {
    conditions.push(eq(livres.serieId, filtres.serieId));
  }
  if (filtres.recherche?.trim()) {
    const motif = `%${filtres.recherche.trim()}%`;
    // ilike : la recherche d'une bibliothèque personnelle se fait au jugé,
    // pas à la casse près. Un index trigram serait le prochain palier.
    conditions.push(
      or(
        ilike(livres.titre, motif),
        ilike(livres.auteur, motif),
        ilike(series.nom, motif),
      )!,
    );
  }

  const ordre = {
    recent: [desc(livres.creeLe)],
    titre: [asc(livres.titre)],
    auteur: [asc(livres.auteur), asc(livres.titre)],
    note: [desc(sql`${livres.note} nulls last`), asc(livres.titre)],
  }[filtres.tri ?? "recent"];

  const q = db
    .select(CHAMPS_LISTE)
    .from(livres)
    .leftJoin(series, eq(series.id, livres.serieId))
    .where(and(...conditions))
    .orderBy(...ordre);

  return filtres.limite ? q.limit(filtres.limite) : q;
}

export async function compterParStatut(utilisateurId: string) {
  const lignes = await db
    .select({ statut: livres.statut, total: count() })
    .from(livres)
    .where(eq(livres.utilisateurId, utilisateurId))
    .groupBy(livres.statut);

  const parStatut = Object.fromEntries(
    lignes.map((l) => [l.statut ?? "a_lire", Number(l.total)]),
  ) as Record<Statut, number>;

  const total = lignes.reduce((s, l) => s + Number(l.total), 0);
  return { parStatut, total };
}

/** Fiche complète : le livre, sa série, son historique et ses citations. */
export async function livreParId(utilisateurId: string, id: number) {
  const [livre] = await db
    .select({
      ...CHAMPS_LISTE,
      synopsis: livres.synopsis,
      resume: livres.resume,
      avis: livres.avis,
      prix: livres.prix,
      dateSortie: livres.dateSortie,
      dureeMinutes: livres.dureeMinutes,
      sousGenre: livres.sousGenre,
      isbn13: livres.isbn13,
      axeIntensite: livres.axeIntensite,
      axeEmotion: livres.axeEmotion,
      axeNoirceur: livres.axeNoirceur,
      axeRomance: livres.axeRomance,
    })
    .from(livres)
    .leftJoin(series, eq(series.id, livres.serieId))
    .where(and(eq(livres.id, id), eq(livres.utilisateurId, utilisateurId)))
    .limit(1);

  if (!livre) return null;

  const historique = await db
    .select()
    .from(lectures)
    .where(eq(lectures.livreId, id))
    .orderBy(desc(lectures.debut));

  const ids = historique.map((l) => l.id);
  const journal = ids.length
    ? await db
        .select()
        .from(sessions)
        .where(inArray(sessions.lectureId, ids))
        .orderBy(desc(sessions.jour), desc(sessions.id))
    : [];

  const extraits = await db
    .select()
    .from(citations)
    .where(eq(citations.livreId, id))
    .orderBy(desc(citations.creeLe));

  return { livre, historique, journal, extraits };
}

/** Lecture ouverte du livre, celle sur laquelle une session vient se poser. */
export async function lectureOuverte(livreId: number) {
  const [l] = await db
    .select()
    .from(lectures)
    .where(and(eq(lectures.livreId, livreId), isNull(lectures.fin)))
    .orderBy(desc(lectures.id))
    .limit(1);
  return l ?? null;
}
