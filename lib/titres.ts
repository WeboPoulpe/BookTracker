/**
 * Extraction de la série et du tome depuis un titre.
 *
 * Deux conventions cohabitent dans les exports :
 *   · anglo-saxonne — « Le Palais des vents (Les Sept Sœurs, #4) »
 *   · française     — « La chronique des Bridgerton : Tome 5&6 »
 *
 * Aucun catalogue ne renseigne la série dans un champ dédié : elle est
 * toujours à retrouver dans le titre.
 */

export type TitreDecompose = {
  titre: string;
  serie: string | null;
  tome: number | null;
};

/** « Titre (Série, #4) » — convention Goodreads et Open Library. */
function parenthese(brut: string): TitreDecompose | null {
  const m = brut.match(/^(.*?)\s*\(([^()]*?),?\s*#(\d+(?:\.\d+)?)\s*\)\s*$/);
  if (!m) return null;

  const [, base, serie, tome] = m;
  return {
    titre: base.trim(),
    serie: serie.trim() || null,
    tome: Number.parseFloat(tome),
  };
}

/**
 * « Série : Tome 5&6 », « Série, Tomes 7 & 8 », « Série 1&2 ».
 *
 * Les intégrales couvrent plusieurs volumes ; on retient le premier, seul
 * numéro qu'une colonne `numeric` puisse porter. Ranger l'intégrale des
 * tomes 5 et 6 au tome 5 la place au bon endroit sur l'étagère, ce qu'un
 * tome vide ne ferait pas.
 */
function tomeFrancais(brut: string): TitreDecompose | null {
  const m = brut.match(
    /^(.*?)[\s,:]*\b(?:tomes?|volumes?|vol\.?|livres?)\s*(\d+(?:\.\d+)?)(?:\s*(?:&|et|-|–|à)\s*\d+)?\s*$/i,
  );
  if (m) {
    const serie = m[1].replace(/[\s,:;–-]+$/, "").trim();
    return serie
      ? { titre: brut.trim(), serie, tome: Number.parseFloat(m[2]) }
      : null;
  }

  // « Série 1&2 » — sans le mot « tome ». Exige la plage, sinon « 1984 »
  // deviendrait le tome 1984 d'une série nommée « ».
  const plage = brut.match(/^(.*?[^\d\s])\s+(\d{1,2})\s*(?:&|et)\s*(\d{1,2})\s*$/);
  if (plage) {
    const serie = plage[1].replace(/[\s,:;–-]+$/, "").trim();
    return serie
      ? { titre: brut.trim(), serie, tome: Number.parseFloat(plage[2]) }
      : null;
  }

  return null;
}

export function decomposerTitre(brut: string): TitreDecompose {
  const propre = brut.trim();
  // Le BOM UTF-8 colle au premier titre d'un fichier exporté.
  const sansBom = propre.replace(/^﻿/, "");

  return (
    parenthese(sansBom) ??
    tomeFrancais(sansBom) ?? { titre: sansBom, serie: null, tome: null }
  );
}
