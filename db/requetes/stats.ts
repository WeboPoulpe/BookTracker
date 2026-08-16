import { and, desc, eq, gte, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { lectures, livres, sessions } from "@/db/schema";

import { DERNIERE_SESSION, PAGE_ATTEINTE } from "./expressions";
import {
  classement,
  dominant,
  rythmeMensuel,
  serieDeJours,
  tauxAbandon,
} from "@/lib/stats";

export async function tableauDeBord(utilisateurId: string) {
  const annee = new Date().getFullYear();
  const debutAnnee = `${annee}-01-01`;

  const [termines, tousLivres, joursLus, enCours] = await Promise.all([
    // Lectures terminées cette année, avec les métadonnées du livre
    db
      .select({
        fin: lectures.fin,
        abandonnee: lectures.abandonnee,
        pages: livres.pages,
        genre: livres.genre,
        auteur: livres.auteur,
      })
      .from(lectures)
      .innerJoin(livres, eq(livres.id, lectures.livreId))
      .where(
        and(
          eq(livres.utilisateurId, utilisateurId),
          isNotNull(lectures.fin),
          gte(lectures.fin, debutAnnee),
        ),
      ),

    db
      .select({ statut: livres.statut, genre: livres.genre })
      .from(livres)
      .where(eq(livres.utilisateurId, utilisateurId)),

    // Jours distincts où une session a été enregistrée — base de la série
    db
      .selectDistinct({ jour: sessions.jour })
      .from(sessions)
      .innerJoin(lectures, eq(lectures.id, sessions.lectureId))
      .innerJoin(livres, eq(livres.id, lectures.livreId))
      .where(eq(livres.utilisateurId, utilisateurId))
      .orderBy(desc(sessions.jour))
      .limit(400),

    // Les livres en cours, avec la page atteinte
    db
      .select({
        id: livres.id,
        titre: livres.titre,
        auteur: livres.auteur,
        pages: livres.pages,
        couvertureUrl: livres.couvertureUrl,
        genre: livres.genre,
        pageAtteinte: PAGE_ATTEINTE,
        derniereSession: DERNIERE_SESSION,
      })
      .from(livres)
      .where(
        and(eq(livres.utilisateurId, utilisateurId), eq(livres.statut, "en_cours")),
      )
      .orderBy(desc(livres.creeLe))
      .limit(10),
  ]);

  const lusAnnee = termines.filter((t) => !t.abandonnee);
  const abandonsAnnee = termines.filter((t) => t.abandonnee);

  const abandonsTotal = tousLivres.filter((l) => l.statut === "abandonne").length;
  const lusTotal = tousLivres.filter((l) => l.statut === "lu").length;

  return {
    annee,
    livresAnnee: lusAnnee.length,
    pagesAnnee: lusAnnee.reduce((s, t) => s + (t.pages ?? 0), 0),
    serie: serieDeJours(joursLus.map((j) => j.jour)),
    rythme: rythmeMensuel(
      lusAnnee.map((t) => t.fin),
      annee,
    ),
    genreDominant: dominant(tousLivres.map((l) => l.genre)),
    topAuteurs: classement(lusAnnee.map((t) => t.auteur)),
    tauxAbandon: tauxAbandon(lusTotal, abandonsTotal),
    abandonsAnnee: abandonsAnnee.length,
    enCours,
    total: tousLivres.length,
  };
}
