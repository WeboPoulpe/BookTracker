import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { citations, lectures, livres, series, sessions } from "@/db/schema";
import { erreur } from "@/lib/api";
import { versCsvGoodreads } from "@/lib/goodreads";
import { utilisateurCourantId } from "@/lib/utilisateur";

export const maxDuration = 60;

/**
 * Export — CSV Goodreads ou JSON complet.
 *
 * « Toujours accessible, jamais derrière un paywall » (§2). Le CSV reste
 * réimportable ailleurs ; le JSON, lui, ne perd rien — sessions, citations et
 * historique de relecture n'ont pas d'équivalent dans le format Goodreads.
 */
export async function GET(requete: Request) {
  const format = new URL(requete.url).searchParams.get("format") ?? "json";
  const jour = new Date().toISOString().slice(0, 10);

  try {
    const utilisateurId = await utilisateurCourantId();

    const lignes = await db
      .select({
        id: livres.id,
        titre: livres.titre,
        auteur: livres.auteur,
        isbn13: livres.isbn13,
        pages: livres.pages,
        dureeMinutes: livres.dureeMinutes,
        format: livres.format,
        genre: livres.genre,
        sousGenre: livres.sousGenre,
        note: livres.note,
        statut: livres.statut,
        priorite: livres.priorite,
        tome: livres.tome,
        serieNom: series.nom,
        serieTomesTotal: series.tomesTotal,
        avis: livres.avis,
        humeur: livres.humeur,
        emoji: livres.emoji,
        axeIntensite: livres.axeIntensite,
        axeEmotion: livres.axeEmotion,
        axeNoirceur: livres.axeNoirceur,
        axeRomance: livres.axeRomance,
        prix: livres.prix,
        dateSortie: livres.dateSortie,
        creeLe: livres.creeLe,
      })
      .from(livres)
      .leftJoin(series, eq(series.id, livres.serieId))
      .where(eq(livres.utilisateurId, utilisateurId))
      .orderBy(asc(livres.titre));

    if (format === "csv") {
      const historique = await db
        .select({
          livreId: lectures.livreId,
          debut: lectures.debut,
          fin: lectures.fin,
        })
        .from(lectures)
        .orderBy(asc(lectures.debut));

      const parLivre = new Map<number, { debut: string | null; fin: string | null }>();
      for (const h of historique) {
        // On garde la première lecture : c'est celle que Goodreads stocke
        if (!parLivre.has(h.livreId)) {
          parLivre.set(h.livreId, { debut: h.debut, fin: h.fin });
        }
      }

      const csv = versCsvGoodreads(
        lignes.map((l) => ({
          titre: l.titre,
          auteur: l.auteur,
          isbn13: l.isbn13,
          pages: l.pages,
          note: l.note,
          statut: l.statut,
          serieNom: l.serieNom,
          tome: l.tome,
          avis: l.avis,
          dateAjout: parLivre.get(l.id)?.debut ?? null,
          dateLecture: parLivre.get(l.id)?.fin ?? null,
        })),
      );

      // BOM : sans lui, Excel affiche « Les Sept SÅ“urs »
      return new NextResponse(`﻿${csv}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ma-bibliotheque-${jour}.csv"`,
        },
      });
    }

    const [toutesLectures, toutesSessions, toutesCitations, toutesSeries] =
      await Promise.all([
        db.select().from(lectures),
        db.select().from(sessions),
        db.select().from(citations),
        db.select().from(series).where(eq(series.utilisateurId, utilisateurId)),
      ]);

    const idsLivres = new Set(lignes.map((l) => l.id));
    const lecturesFiltrees = toutesLectures.filter((l) =>
      idsLivres.has(l.livreId),
    );
    const idsLectures = new Set(lecturesFiltrees.map((l) => l.id));

    const contenu = {
      version: 1,
      exporteLe: new Date().toISOString(),
      livres: lignes,
      series: toutesSeries,
      lectures: lecturesFiltrees,
      sessions: toutesSessions.filter((s) => idsLectures.has(s.lectureId)),
      citations: toutesCitations.filter((c) => idsLivres.has(c.livreId)),
    };

    return new NextResponse(JSON.stringify(contenu, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="ma-bibliotheque-${jour}.json"`,
      },
    });
  } catch (e) {
    console.error("GET /api/export", e);
    return erreur("serveur", "Export impossible.", 500);
  }
}
