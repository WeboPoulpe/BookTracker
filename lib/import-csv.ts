import Papa from "papaparse";

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

export type Format = "goodreads" | "storygraph" | "inconnu";

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
  inconnu: "format inconnu",
};

/** Lit la seule ligne d'en-tête, sans analyser tout le fichier. */
export function detecterFormat(csv: string): Format {
  const { meta } = Papa.parse(csv, {
    header: true,
    preview: 1,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const colonnes = meta.fields ?? [];

  // `Exclusive Shelf` est la signature de Goodreads ; on la teste en premier,
  // StoryGraph ayant aussi une colonne « Read Status ».
  if (colonnes.includes("Exclusive Shelf")) return "goodreads";
  if (estStorygraph(colonnes)) return "storygraph";
  return "inconnu";
}

export function analyserCsv(csv: string): Analyse {
  const format = detecterFormat(csv);

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
