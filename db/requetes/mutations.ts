import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { citations, lectures, livres, series, sessions } from "@/db/schema";
import type { LivreValide } from "@/lib/validation";

/** Trouve la série par son nom, ou la crée. Insensible à la casse. */
export async function resoudreSerie(
  utilisateurId: string,
  nom: string | null | undefined,
  auteur?: string | null,
): Promise<number | null> {
  const propre = nom?.trim();
  if (!propre) return null;

  const [existante] = await db
    .select({ id: series.id })
    .from(series)
    .where(
      and(
        eq(series.utilisateurId, utilisateurId),
        sql`lower(${series.nom}) = lower(${propre})`,
      ),
    )
    .limit(1);

  if (existante) return existante.id;

  const [creee] = await db
    .insert(series)
    .values({ utilisateurId, nom: propre, auteur: auteur ?? null })
    .onConflictDoNothing({
      target: [series.utilisateurId, series.nom],
    })
    .returning({ id: series.id });

  if (creee) return creee.id;

  // Course entre deux insertions simultanées : la ligne existe désormais
  const [apres] = await db
    .select({ id: series.id })
    .from(series)
    .where(
      and(eq(series.utilisateurId, utilisateurId), eq(series.nom, propre)),
    )
    .limit(1);
  return apres?.id ?? null;
}

export async function creerLivre(utilisateurId: string, valeurs: LivreValide) {
  const { serie, ...champs } = valeurs;
  const serieId = await resoudreSerie(utilisateurId, serie, champs.auteur);

  const [livre] = await db
    .insert(livres)
    .values({ ...champs, utilisateurId, serieId })
    .returning();

  // Un livre créé « en cours » ou « lu » doit avoir sa lecture, sinon la
  // première session n'aurait rien où se rattacher.
  if (livre.statut === "en_cours") {
    await db.insert(lectures).values({
      livreId: livre.id,
      debut: new Date().toISOString().slice(0, 10),
    });
  } else if (livre.statut === "lu") {
    await db.insert(lectures).values({
      livreId: livre.id,
      fin: new Date().toISOString().slice(0, 10),
      pageFinale: livre.pages ?? null,
    });
  }

  return livre;
}

export async function majLivre(
  utilisateurId: string,
  id: number,
  valeurs: Partial<LivreValide>,
) {
  const { serie, ...champs } = valeurs;

  const patch: Record<string, unknown> = { ...champs };
  if (serie !== undefined) {
    patch.serieId = await resoudreSerie(utilisateurId, serie, champs.auteur);
  }
  if (Object.keys(patch).length === 0) return null;

  const [maj] = await db
    .update(livres)
    .set(patch)
    .where(and(eq(livres.id, id), eq(livres.utilisateurId, utilisateurId)))
    .returning();

  return maj ?? null;
}

/**
 * Change le statut et tient l'historique de lecture à jour.
 *
 * C'est ici que se joue la séparation `livres` / `lectures` : repasser un
 * livre « lu » en « en cours » ouvre une *nouvelle* lecture au lieu de
 * réécrire la précédente. Une relecture ne doit pas effacer la première.
 */
export async function changerStatut(
  utilisateurId: string,
  id: number,
  statut: "a_lire" | "en_cours" | "lu" | "abandonne" | "en_pause",
) {
  const [livre] = await db
    .select()
    .from(livres)
    .where(and(eq(livres.id, id), eq(livres.utilisateurId, utilisateurId)))
    .limit(1);

  if (!livre) return null;

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [ouverte] = await db
    .select()
    .from(lectures)
    .where(and(eq(lectures.livreId, id), isNull(lectures.fin)))
    .orderBy(desc(lectures.id))
    .limit(1);

  if (statut === "en_cours" && !ouverte) {
    await db.insert(lectures).values({ livreId: id, debut: aujourdhui });
  }

  if (statut === "lu" || statut === "abandonne") {
    // À défaut de lecture ouverte, on réutilise celle déjà close aujourd'hui.
    //
    // Sans ça, hésiter sur un statut — « lu », puis « à lire », puis « lu » —
    // enregistre deux lectures du même livre le même jour, et le compteur de
    // livres lus de l'année s'en trouve gonflé. Une vraie relecture bouclée
    // dans la journée est un cas si rare qu'il vaut mieux la saisir à la main
    // que d'accepter ce faux positif à chaque tâtonnement.
    const [closeAujourdhui] = ouverte
      ? []
      : await db
          .select()
          .from(lectures)
          .where(and(eq(lectures.livreId, id), eq(lectures.fin, aujourdhui)))
          .orderBy(desc(lectures.id))
          .limit(1);

    const cible = ouverte ?? closeAujourdhui;

    if (cible) {
      await db
        .update(lectures)
        .set({
          fin: aujourdhui,
          abandonnee: statut === "abandonne",
          pageFinale: statut === "lu" ? (livre.pages ?? null) : null,
        })
        .where(eq(lectures.id, cible.id));
    } else {
      await db.insert(lectures).values({
        livreId: id,
        debut: null,
        fin: aujourdhui,
        abandonnee: statut === "abandonne",
        pageFinale: statut === "lu" ? (livre.pages ?? null) : null,
      });
    }
  }

  // « en pause » et « à lire » laissent la lecture ouverte : c'est justement
  // ce qui distingue une saga mise de côté d'une saga abandonnée.

  const [maj] = await db
    .update(livres)
    .set({ statut })
    .where(eq(livres.id, id))
    .returning();

  return maj ?? null;
}

/** Enregistre une session de lecture. Le geste central de l'app. */
export async function enregistrerSession(
  utilisateurId: string,
  entree: {
    livreId: number;
    jour?: string;
    pageAtteinte?: number | null;
    minutes?: number | null;
    noteRapide?: string | null;
    termine?: boolean;
  },
) {
  const [livre] = await db
    .select()
    .from(livres)
    .where(
      and(eq(livres.id, entree.livreId), eq(livres.utilisateurId, utilisateurId)),
    )
    .limit(1);

  if (!livre) return null;

  const jour = entree.jour ?? new Date().toISOString().slice(0, 10);

  let [lecture] = await db
    .select()
    .from(lectures)
    .where(and(eq(lectures.livreId, livre.id), isNull(lectures.fin)))
    .orderBy(desc(lectures.id))
    .limit(1);

  // Logger une session sur un livre « à lire » démarre la lecture : exiger un
  // changement de statut préalable ajouterait un geste au geste unique.
  if (!lecture) {
    [lecture] = await db
      .insert(lectures)
      .values({ livreId: livre.id, debut: jour })
      .returning();
  }

  const [session] = await db
    .insert(sessions)
    .values({
      lectureId: lecture.id,
      jour,
      pageAtteinte: entree.pageAtteinte ?? null,
      minutes: entree.minutes ?? null,
      noteRapide: entree.noteRapide ?? null,
    })
    .returning();

  const termine =
    entree.termine ||
    (livre.pages != null &&
      entree.pageAtteinte != null &&
      entree.pageAtteinte >= livre.pages);

  if (termine) {
    await db
      .update(lectures)
      .set({ fin: jour, pageFinale: entree.pageAtteinte ?? livre.pages ?? null })
      .where(eq(lectures.id, lecture.id));
    await db.update(livres).set({ statut: "lu" }).where(eq(livres.id, livre.id));
  } else if (livre.statut !== "en_cours") {
    await db
      .update(livres)
      .set({ statut: "en_cours" })
      .where(eq(livres.id, livre.id));
  }

  return { session, termine };
}

export async function supprimerLivre(utilisateurId: string, id: number) {
  const [supprime] = await db
    .delete(livres)
    .where(and(eq(livres.id, id), eq(livres.utilisateurId, utilisateurId)))
    .returning({ id: livres.id });
  return supprime ?? null;
}

/**
 * Vérifie qu'une session appartient bien à l'utilisateur.
 *
 * Une session ne porte pas d'identifiant d'utilisateur : elle pend à une
 * lecture, qui pend à un livre. Sans cette remontée, n'importe quel
 * identifiant de session serait supprimable par n'importe qui.
 */
async function sessionPossedee(utilisateurId: string, sessionId: number) {
  const [ligne] = await db
    .select({ id: sessions.id, lectureId: sessions.lectureId })
    .from(sessions)
    .innerJoin(lectures, eq(lectures.id, sessions.lectureId))
    .innerJoin(livres, eq(livres.id, lectures.livreId))
    .where(
      and(eq(sessions.id, sessionId), eq(livres.utilisateurId, utilisateurId)),
    )
    .limit(1);
  return ligne ?? null;
}

export async function supprimerSession(utilisateurId: string, id: number) {
  const possedee = await sessionPossedee(utilisateurId, id);
  if (!possedee) return null;

  await db.delete(sessions).where(eq(sessions.id, id));
  return { id };
}

export async function majSession(
  utilisateurId: string,
  id: number,
  valeurs: {
    jour?: string;
    pageAtteinte?: number | null;
    minutes?: number | null;
    noteRapide?: string | null;
  },
) {
  const possedee = await sessionPossedee(utilisateurId, id);
  if (!possedee) return null;

  const [maj] = await db
    .update(sessions)
    .set(valeurs)
    .where(eq(sessions.id, id))
    .returning();
  return maj ?? null;
}

export async function supprimerLecture(utilisateurId: string, id: number) {
  const [ligne] = await db
    .select({ id: lectures.id })
    .from(lectures)
    .innerJoin(livres, eq(livres.id, lectures.livreId))
    .where(and(eq(lectures.id, id), eq(livres.utilisateurId, utilisateurId)))
    .limit(1);

  if (!ligne) return null;

  // Les sessions partent en cascade : supprimer une lecture, c'est effacer
  // la période entière, pas la détacher de son journal.
  await db.delete(lectures).where(eq(lectures.id, id));
  return { id };
}

export async function supprimerCitation(utilisateurId: string, id: number) {
  const [ligne] = await db
    .select({ id: citations.id })
    .from(citations)
    .innerJoin(livres, eq(livres.id, citations.livreId))
    .where(and(eq(citations.id, id), eq(livres.utilisateurId, utilisateurId)))
    .limit(1);

  if (!ligne) return null;

  await db.delete(citations).where(eq(citations.id, id));
  return { id };
}

export async function majCitation(
  utilisateurId: string,
  id: number,
  valeurs: { texte?: string; page?: number | null },
) {
  const [ligne] = await db
    .select({ id: citations.id })
    .from(citations)
    .innerJoin(livres, eq(livres.id, citations.livreId))
    .where(and(eq(citations.id, id), eq(livres.utilisateurId, utilisateurId)))
    .limit(1);

  if (!ligne) return null;

  const [maj] = await db
    .update(citations)
    .set(valeurs)
    .where(eq(citations.id, id))
    .returning();
  return maj ?? null;
}

export async function ajouterCitation(
  utilisateurId: string,
  entree: { livreId: number; texte: string; page?: number | null },
) {
  const [livre] = await db
    .select({ id: livres.id })
    .from(livres)
    .where(
      and(eq(livres.id, entree.livreId), eq(livres.utilisateurId, utilisateurId)),
    )
    .limit(1);

  if (!livre) return null;

  const [citation] = await db
    .insert(citations)
    .values({
      livreId: entree.livreId,
      texte: entree.texte,
      page: entree.page ?? null,
    })
    .returning();

  return citation;
}
