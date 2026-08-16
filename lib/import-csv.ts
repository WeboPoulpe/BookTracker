import Papa from "papaparse";

import { analyserBookmory, estBookmory } from "./bookmory";
import { analyser as analyserGoodreads, type LivreImporte, type Rejet } from "./goodreads";
import { analyserStorygraph, estStorygraph } from "./storygraph";

/**
 * Détection du format d'export, et analyse.
 *
 * Deux fichiers arrivent en pratique : l'export Goodreads et celui de
 * StoryGraph, que beaucoup de lectrices ont adopté depuis qu'Amazon a fermé
 * l'API du premier. Ils n'ont aucune colonne en commun hormis le titre.
 *
 * Détecter plutôt que demander : personne ne sait de tête quel outil a
 * produit le CSV qu'il vient de télécharger, et se tromper de bouton ne
 * donnerait qu'un « aucune ligne exploitable » incompréhensible.
 */

export type Format = "goodreads" | "storygraph" | "bookmory" | "inconnu";

export type Analyse = {
  format: Format;
  livres: LivreImporte[];
  rejets: Rejet[];
  colonnesManquantes: string[];
  total: number;
  /** Livres lus sans date de lecture : la date d'ajout fait foi */
  datesApprochees: number;
  /** Livres à plusieurs auteurs : seul le premier est retenu */
  auteursMultiples: number;
};

export const NOM_FORMAT: Record<Format, string> = {
  goodreads: "Goodreads",
  storygraph: "StoryGraph",
  bookmory: "Bookmory",
  inconnu: "format inconnu",
};

/** Lit les deux premières lignes, sans analyser tout le fichier. */
export function detecterFormat(csv: string): Format {
  const { data } = Papa.parse<string[]>(csv, {
    header: false,
    preview: 2,
    skipEmptyLines: true,
  });

  // Bookmory en premier : son en-tête tient sur deux lignes, et une lecture
  // « header: true » prendrait la ligne de regroupement pour les colonnes.
  if (estBookmory(data)) return "bookmory";

  const colonnes = (data[0] ?? []).map((c) => c.trim());

  // `Exclusive Shelf` est la signature de Goodreads ; on la teste avant
  // StoryGraph, qui a lui aussi une colonne « Read Status ».
  if (colonnes.includes("Exclusive Shelf")) return "goodreads";
  if (estStorygraph(colonnes)) return "storygraph";
  return "inconnu";
}

export function analyserCsv(csv: string): Analyse {
  const format = detecterFormat(csv);

  if (format === "bookmory") {
    return { format, ...analyserBookmory(csv) };
  }

  if (format === "storygraph") {
    return { format, ...analyserStorygraph(csv) };
  }

  const a = analyserGoodreads(csv);
  return {
    format,
    ...a,
    // Goodreads n'apporte ni l'un ni l'autre : ses dates sont exactes ou
    // absentes, et sa colonne `Author` ne contient qu'un nom.
    datesApprochees: 0,
    auteursMultiples: 0,
  };
}
