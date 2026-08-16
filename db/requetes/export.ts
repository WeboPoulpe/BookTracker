import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { citations, couvertures, lectures, livres, series, sessions } from "@/db/schema";

/**
 * Instantané complet de la bibliothèque.
 *
 * C'est le seul filet de sécurité de l'app : aucune sauvegarde automatique
 * n'est en place, l'export manuel en tient lieu. Il doit donc être complet.
 *
 * Les couvertures importées ne sont pas incluses. Elles pèsent des dizaines
 * de kilo-octets chacune et feraient exploser le volume, pour des images
 * rechargeables. Leur nombre est rapporté, afin qu'une restauration sache ce
 * qui manque.
 */
export type ExportComplet = {
  version: number;
  exporteLe: string;
  livres: unknown[];
  series: unknown[];
  lectures: unknown[];
  sessions: unknown[];
  citations: unknown[];
  couverturesNonIncluses: number;
};

export async function exportComplet(
  utilisateurId: string,
): Promise<ExportComplet> {
  const lignes = await db
    .select({
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
      note: livres.note,
      statut: livres.statut,
      priorite: livres.priorite,
      tome: livres.tome,
      serieNom: series.nom,
      serieTomesTotal: series.tomesTotal,
      synopsis: livres.synopsis,
      resume: livres.resume,
      avis: livres.avis,
      humeur: livres.humeur,
      emoji: livres.emoji,
      axeIntrigue: livres.axeIntrigue,
      axePersonnages: livres.axePersonnages,
      axeEmotion: livres.axeEmotion,
      axeThemes: livres.axeThemes,
      prix: livres.prix,
      dateSortie: livres.dateSortie,
      creeLe: livres.creeLe,
    })
    .from(livres)
    .leftJoin(series, eq(series.id, livres.serieId))
    .where(eq(livres.utilisateurId, utilisateurId))
    .orderBy(asc(livres.titre));

  const [toutesLectures, toutesSessions, toutesCitations, toutesSeries, couv] =
    await Promise.all([
      db.select().from(lectures),
      db.select().from(sessions),
      db.select().from(citations),
      db.select().from(series).where(eq(series.utilisateurId, utilisateurId)),
      db.select({ livreId: couvertures.livreId }).from(couvertures),
    ]);

  // Les tables filles n'ont pas d'identifiant d'utilisateur : on les filtre
  // par appartenance, faute de quoi une base multi-utilisateurs exporterait
  // les données de tout le monde.
  const idsLivres = new Set(lignes.map((l) => l.id));
  const lecturesFiltrees = toutesLectures.filter((l) =>
    idsLivres.has(l.livreId),
  );
  const idsLectures = new Set(lecturesFiltrees.map((l) => l.id));

  return {
    version: 1,
    exporteLe: new Date().toISOString(),
    livres: lignes,
    series: toutesSeries,
    lectures: lecturesFiltrees,
    sessions: toutesSessions.filter((s) => idsLectures.has(s.lectureId)),
    citations: toutesCitations.filter((c) => idsLivres.has(c.livreId)),
    couverturesNonIncluses: couv.filter((c) => idsLivres.has(c.livreId)).length,
  };
}
