import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { lectures, livres } from "@/db/schema";
import type { LivreImporte } from "@/lib/goodreads";

import { resoudreSerie } from "./mutations";

export type ResultatLot = {
  crees: number;
  ignores: number;
  echecs: Array<{ titre: string; motif: string }>;
};

/**
 * Empreinte de dédoublonnage.
 *
 * L'ISBN quand il existe, sinon titre+auteur normalisés. Réimporter le même
 * export Goodreads ne doit pas dupliquer la bibliothèque — c'est le geste
 * qu'on fait naturellement quand un premier import a échoué à mi-chemin.
 */
function empreinte(titre: string, auteur: string) {
  return `${titre.trim().toLowerCase()}|${auteur.trim().toLowerCase()}`;
}

export async function importerLot(
  utilisateurId: string,
  lot: LivreImporte[],
): Promise<ResultatLot> {
  const resultat: ResultatLot = { crees: 0, ignores: 0, echecs: [] };
  if (lot.length === 0) return resultat;

  // Un seul aller-retour pour connaître l'existant, au lieu d'un par livre :
  // sur un import de 800 titres, la différence est de plusieurs minutes.
  const existants = await db
    .select({
      isbn13: livres.isbn13,
      titre: livres.titre,
      auteur: livres.auteur,
    })
    .from(livres)
    .where(eq(livres.utilisateurId, utilisateurId));

  const isbnsConnus = new Set(
    existants.map((e) => e.isbn13).filter((i): i is string => Boolean(i)),
  );
  const empreintesConnues = new Set(
    existants.map((e) => empreinte(e.titre, e.auteur)),
  );

  for (const entree of lot) {
    const cle = empreinte(entree.titre, entree.auteur);

    if (
      (entree.isbn13 && isbnsConnus.has(entree.isbn13)) ||
      empreintesConnues.has(cle)
    ) {
      resultat.ignores += 1;
      continue;
    }

    try {
      const serieId = await resoudreSerie(
        utilisateurId,
        entree.serie,
        entree.auteur,
      );

      const [livre] = await db
        .insert(livres)
        .values({
          utilisateurId,
          titre: entree.titre,
          auteur: entree.auteur,
          isbn13: entree.isbn13,
          pages: entree.pages,
          note: entree.note,
          statut: entree.statut,
          serieId,
          tome: entree.tome,
          avis: entree.avis,
          format: entree.format,
          humeur: entree.humeur ?? null,
          emoji: entree.emoji ?? null,
          axeIntrigue: entree.axeIntrigue ?? null,
          axePersonnages: entree.axePersonnages ?? null,
          axeThemes: entree.axeThemes ?? null,
          // Couverture résolue après coup : la deviner depuis l'ISBN sans
          // vérifier produirait des images cassées en masse.
          couvertureUrl: null,
        })
        .returning({ id: livres.id, pages: livres.pages });

      /* Une ligne de `lectures` par période datée : c'est ainsi qu'une
         relecture cesse d'écraser la première, et StoryGraph les encode
         toutes dans sa colonne `Dates Read`. */
      if (entree.periodes?.length) {
        await db.insert(lectures).values(
          entree.periodes.map((p) => ({
            livreId: livre.id,
            debut: p.debut,
            fin: p.fin,
            abandonnee: entree.statut === "abandonne",
            pageFinale: entree.statut === "lu" ? livre.pages : null,
          })),
        );
      } else if (
        // À défaut de périodes, l'historique ne se reconstruit que si le
        // catalogue a livré une date. Inventer un début de lecture
        // fausserait toutes les statistiques.
        (entree.dateAjout || entree.dateLecture) &&
        entree.statut !== "a_lire"
      ) {
        await db.insert(lectures).values({
          livreId: livre.id,
          debut: entree.dateAjout,
          fin: entree.statut === "en_cours" ? null : entree.dateLecture,
          abandonnee: entree.statut === "abandonne",
          pageFinale: entree.statut === "lu" ? livre.pages : null,
        });
      }

      isbnsConnus.add(entree.isbn13 ?? "");
      empreintesConnues.add(cle);
      resultat.crees += 1;
    } catch (e) {
      resultat.echecs.push({
        titre: entree.titre,
        motif: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  }

  return resultat;
}

/**
 * Complète les couvertures manquantes depuis Open Library.
 *
 * Le CSV n'en contient aucune. On plafonne le débit (§6 : 10 req/s) pour ne
 * pas se faire couper par Open Library au milieu d'une bibliothèque.
 */
export async function completerCouvertures(
  utilisateurId: string,
  limite = 40,
): Promise<{ traites: number; trouves: number; restants: number }> {
  const candidats = await db
    .select({ id: livres.id, isbn13: livres.isbn13 })
    .from(livres)
    .where(
      and(
        eq(livres.utilisateurId, utilisateurId),
        isNotNull(livres.isbn13),
        sql`${livres.couvertureUrl} is null`,
      ),
    )
    .limit(limite);

  let trouves = 0;

  for (const c of candidats) {
    const url = `https://covers.openlibrary.org/b/isbn/${c.isbn13}-M.jpg`;
    try {
      // `default=false` : sans ça, Open Library renvoie une image « pas de
      // couverture » en 200, et on enregistrerait un placeholder gris.
      const r = await fetch(`${url}?default=false`, { method: "HEAD" });
      if (r.ok) {
        await db
          .update(livres)
          .set({ couvertureUrl: url })
          .where(eq(livres.id, c.id));
        trouves += 1;
      }
    } catch {
      // Une couverture absente n'est pas un échec d'import : le repli
      // graphique (§7) est prévu pour ça.
    }
    await new Promise((r) => setTimeout(r, 100)); // 10 req/s
  }

  const [{ restants }] = await db
    .select({ restants: sql<number>`count(*)::int` })
    .from(livres)
    .where(
      and(
        eq(livres.utilisateurId, utilisateurId),
        isNotNull(livres.isbn13),
        sql`${livres.couvertureUrl} is null`,
      ),
    );

  return { traites: candidats.length, trouves, restants };
}
