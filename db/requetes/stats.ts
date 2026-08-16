import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { livres } from "@/db/schema";
import { anneeCourante } from "@/lib/date";

import { DERNIERE_SESSION, PAGE_ATTEINTE } from "./expressions";
import { statistiques, type Statistiques } from "./statistiques";

/**
 * Données de l'accueil.
 *
 * Les chiffres de l'année viennent de `statistiques()`, la même fonction que
 * l'écran Statistiques : les deux écrans ne peuvent donc pas se contredire.
 * Ils se contredisaient d'ailleurs en puissance — l'accueil calculait son
 * « genre dominant » sur toute la bibliothèque, l'écran Statistiques sur les
 * seules lectures de la période. Deux mesures différentes sous le même nom.
 *
 * Ne reste ici que ce qui est propre à l'accueil : les lectures en cours et
 * la taille de la bibliothèque.
 */
export type Accueil = {
  annee: number;
  stats: Statistiques;
  enCours: Array<{
    id: number;
    titre: string;
    auteur: string;
    pages: number | null;
    couvertureUrl: string | null;
    genre: string | null;
    pageAtteinte: number | null;
    derniereSession: string | null;
  }>;
  total: number;
};

export async function tableauDeBord(utilisateurId: string): Promise<Accueil> {
  const annee = anneeCourante();

  const [stats, enCours, [compte]] = await Promise.all([
    statistiques(utilisateurId, { annee, mois: null }),

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
        and(
          eq(livres.utilisateurId, utilisateurId),
          eq(livres.statut, "en_cours"),
        ),
      )
      .orderBy(desc(livres.creeLe))
      .limit(10),

    db
      .select({ total: count() })
      .from(livres)
      .where(eq(livres.utilisateurId, utilisateurId)),
  ]);

  return { annee, stats, enCours, total: Number(compte?.total ?? 0) };
}
