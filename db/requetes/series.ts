import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { livres, series, type Statut } from "@/db/schema";

export type SerieSuivie = {
  id: number;
  nom: string;
  auteur: string | null;
  /** Déclaré par l'utilisateur ; à défaut, le plus grand tome connu */
  tomesTotal: number | null;
  tomesPossedes: number;
  tomesLus: number;
  /** Le prochain tome à lire, dans l'ordre de la série */
  prochain: {
    id: number;
    titre: string;
    tome: number | null;
    statut: Statut | null;
    couvertureUrl: string | null;
    genre: string | null;
  } | null;
  enCours: boolean;
  enPause: boolean;
  genre: string | null;
};

/**
 * Séries avec leur avancement.
 *
 * Le suivi de séries est le critère qui éliminait la moitié des produits du
 * marché (§2). Le point délicat n'est pas de compter les tomes lus, c'est de
 * désigner le *prochain* : ce n'est ni le premier non lu par date d'ajout,
 * ni le tome suivant du dernier lu — c'est le plus petit tome non terminé.
 */
export async function listerSeries(utilisateurId: string): Promise<SerieSuivie[]> {
  const lignes = await db
    .select({
      serieId: series.id,
      serieNom: series.nom,
      serieAuteur: series.auteur,
      tomesTotal: series.tomesTotal,
      id: livres.id,
      titre: livres.titre,
      tome: livres.tome,
      statut: livres.statut,
      couvertureUrl: livres.couvertureUrl,
      genre: livres.genre,
    })
    .from(series)
    .leftJoin(livres, eq(livres.serieId, series.id))
    .where(eq(series.utilisateurId, utilisateurId))
    .orderBy(asc(series.nom), asc(livres.tome));

  const parSerie = new Map<number, SerieSuivie & { _tomes: number[] }>();

  for (const l of lignes) {
    let s = parSerie.get(l.serieId);
    if (!s) {
      s = {
        id: l.serieId,
        nom: l.serieNom,
        auteur: l.serieAuteur,
        tomesTotal: l.tomesTotal,
        tomesPossedes: 0,
        tomesLus: 0,
        prochain: null,
        enCours: false,
        enPause: false,
        genre: null,
        _tomes: [],
      };
      parSerie.set(l.serieId, s);
    }

    // Le LEFT JOIN produit une ligne vide pour une série sans aucun livre.
    // `titre` est NOT NULL en base : le test sur l'identifiant suffit à
    // garantir la ligne, mais TypeScript ne propage pas ce garde aux autres
    // colonnes de la table jointe — d'où la reconstruction explicite.
    if (l.id == null || l.titre == null) continue;
    const livre = { ...l, id: l.id, titre: l.titre };

    s.tomesPossedes += 1;
    if (l.tome != null) s._tomes.push(l.tome);
    if (l.statut === "lu") s.tomesLus += 1;
    if (l.statut === "en_cours") s.enCours = true;
    if (l.statut === "en_pause") s.enPause = true;
    if (!s.genre && l.genre) s.genre = l.genre;

    const aLire = l.statut !== "lu" && l.statut !== "abandonne";
    if (aLire) {
      const meilleur = s.prochain;
      // Un tome en cours prime : c'est là qu'on reprend.
      const prioritaire =
        l.statut === "en_cours" && meilleur?.statut !== "en_cours";
      const plusPetit =
        !meilleur ||
        (meilleur.statut !== "en_cours" &&
          (l.tome ?? Infinity) < (meilleur.tome ?? Infinity));

      if (prioritaire || plusPetit) {
        s.prochain = {
          id: livre.id,
          titre: livre.titre,
          tome: livre.tome,
          statut: livre.statut,
          couvertureUrl: livre.couvertureUrl,
          genre: livre.genre,
        };
      }
    }
  }

  return [...parSerie.values()]
    .map(({ _tomes, ...s }) => ({
      ...s,
      // Sans total déclaré, le plus grand tome possédé est la meilleure
      // approximation — et elle se corrige d'elle-même à chaque ajout.
      tomesTotal: s.tomesTotal ?? (_tomes.length ? Math.max(..._tomes) : null),
    }))
    .filter((s) => s.tomesPossedes > 0)
    .sort((a, b) => {
      // Les séries en cours d'abord : c'est ce qu'on vient chercher.
      if (a.enCours !== b.enCours) return a.enCours ? -1 : 1;
      return a.nom.localeCompare(b.nom, "fr");
    });
}
