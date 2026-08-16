import Papa from "papaparse";

import { genreDepuisEtiquettes, sousGenreDepuisEtiquettes } from "./etiquettes";
import type { LivreImporte, Rejet } from "./goodreads";
import { decomposerTitre } from "./titres";

/**
 * Parseur de l'export Bookmory.
 *
 * Bookmory est une application de suivi de lecture mobile. Son export
 * complète utilement StoryGraph : il porte la **pagination**, absente de
 * StoryGraph, des étiquettes de genre, des notes au demi-point, et jusqu'à
 * deux historiques de lecture par livre.
 *
 * Sa structure impose deux précautions :
 *   · **deux lignes d'en-tête** — la première regroupe les colonnes
 *     (« Historique de lecture 1 »), la seconde les nomme ;
 *   · **des noms de colonnes en double** — « Période de lecture » apparaît
 *     deux fois. On travaille donc par position, jamais par nom.
 */

export type AnalyseBookmory = {
  livres: LivreImporte[];
  rejets: Rejet[];
  colonnesManquantes: string[];
  total: number;
  datesApprochees: number;
  auteursMultiples: number;
};

/** Position de chaque champ dans la seconde ligne d'en-tête. */
const COL = {
  titre: 0,
  auteurs: 1,
  editeur: 5,
  datePublication: 6,
  isbn: 8,
  pages: 9,
  tags: 10,
  statut: 13,
  periode1: 14,
  note1: 15,
  commentaire1: 16,
  periode2: 18,
  note2: 19,
  commentaire2: 20,
  prix: 24,
} as const;

const MOIS: Record<string, number> = {
  janv: 1, janvier: 1,
  fevr: 2, fevrier: 2, "fév": 2,
  mars: 3,
  avr: 4, avril: 4,
  mai: 5,
  juin: 6,
  juil: 7, juillet: 7,
  aout: 8,
  sept: 9, septembre: 9,
  oct: 10, octobre: 10,
  nov: 11, novembre: 11,
  dec: 12, decembre: 12,
};

const DIACRITIQUES = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * « 22 avr. 2025 » → « 2025-04-22 ».
 *
 * Bookmory écrit ses dates en français abrégé, avec le point d'abréviation
 * et parfois un accent. Aucun analyseur de date natif ne les lit.
 */
export function lireDateFr(brut: string | undefined): string | null {
  const t = brut?.trim();
  if (!t) return null;

  // Format ISO déjà propre, utilisé par la date de publication.
  const iso = t.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  const m = t.match(/^(\d{1,2})\s+([^\s.]+)\.?\s+(\d{4})$/);
  if (!m) return null;

  const cle = m[2]
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIQUES, "");
  const mois = MOIS[cle];
  if (!mois) return null;

  return `${m[3]}-${String(mois).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/**
 * « 22 avr. 2025 ~ 1 mai 2025 » → une période.
 *
 * Les deux bornes sont facultatives : « 26 août 2020 ~ » désigne une lecture
 * commencée sans date de fin, « ~ 2 juin 2022 » l'inverse. Seule une fin
 * permet de dater un livre, donc de le compter dans les statistiques.
 */
export function lirePeriode(
  brut: string | undefined,
): { debut: string | null; fin: string | null } | null {
  const t = brut?.trim();
  if (!t || t === "~") return null;

  const [g, d] = t.split("~");
  const debut = lireDateFr(g);
  const fin = lireDateFr(d);
  if (!debut && !fin) return null;

  return { debut, fin };
}

/** « p. 3 342 » → 3342. L'espace est une fine insécable, pas un espace. */
export function lirePages(brut: string | undefined): number | null {
  if (!brut) return null;
  const chiffres = brut.replace(/[^\d]/g, "");
  if (!chiffres) return null;
  const n = Number.parseInt(chiffres, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function lireStatut(brut: string | undefined): LivreImporte["statut"] {
  const t = (brut ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIQUES, "");

  if (t.includes("abandonn")) return "abandonne";
  if (t.includes("tout lu") || t.includes("termine")) return "lu";
  if (t.includes("en cours") || t.includes("lecture en")) return "en_cours";
  if (t.includes("pause")) return "en_pause";
  return "a_lire";
}

/** Bookmory note au demi-point ; 0 signifie « non noté », pas zéro étoile. */
function lireNote(brut: string | undefined): number | null {
  if (!brut?.trim()) return null;
  const n = Number.parseFloat(brut.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 2) / 2;
}

export function analyserBookmory(csv: string): AnalyseBookmory {
  // Sans en-tête : les noms sont en double et répartis sur deux lignes.
  const { data } = Papa.parse<string[]>(csv, {
    header: false,
    skipEmptyLines: "greedy",
  });

  const entete = (data[1] ?? []).map((c) => c.trim());
  const colonnesManquantes = ["Titre", "Auteurs", "Statut"].filter(
    (c) => !entete.includes(c),
  );

  const livres: LivreImporte[] = [];
  const rejets: Rejet[] = [];
  let datesApprochees = 0;
  let auteursMultiples = 0;

  // Les deux premières lignes sont l'en-tête sur deux niveaux.
  data.slice(2).forEach((ligne, i) => {
    const numero = i + 3;
    const champ = (n: number) => (ligne[n] ?? "").trim();

    const titreBrut = champ(COL.titre);
    if (!titreBrut) {
      rejets.push({ ligne: numero, titre: "—", motif: "Titre absent" });
      return;
    }

    const { titre, serie, tome } = decomposerTitre(titreBrut);

    const auteurs = champ(COL.auteurs)
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
    const uniques = [...new Set(auteurs)];
    if (uniques.length > 1) auteursMultiples += 1;

    const statut = lireStatut(champ(COL.statut));

    const periodes = [
      lirePeriode(champ(COL.periode1)),
      lirePeriode(champ(COL.periode2)),
    ]
      .filter((p): p is { debut: string | null; fin: string | null } => p !== null)
      // Seule une fin datée permet de compter le livre dans une année.
      .filter((p) => p.fin !== null)
      .map((p) => ({ debut: p.debut, fin: p.fin as string }));

    // Une lecture commencée sans fin, sur un livre marqué lu : la date de
    // début fait foi, faute de mieux, et c'est annoncé avant confirmation.
    const commencees = [champ(COL.periode1), champ(COL.periode2)]
      .map(lirePeriode)
      .filter((p) => p?.debut && !p.fin);

    if (periodes.length === 0 && statut === "lu" && commencees[0]?.debut) {
      periodes.push({ debut: commencees[0].debut, fin: commencees[0].debut });
      datesApprochees += 1;
    }

    const genre = genreDepuisEtiquettes(champ(COL.tags));
    const note = lireNote(champ(COL.note1)) ?? lireNote(champ(COL.note2));
    const avis =
      champ(COL.commentaire1) || champ(COL.commentaire2) || null;

    const isbnBrut = champ(COL.isbn).replace(/[^0-9Xx]/g, "");
    const prix = Number.parseFloat(champ(COL.prix).replace(",", "."));

    livres.push({
      titre,
      auteur: uniques[0] ?? "Auteur inconnu",
      isbn13:
        isbnBrut.length === 13 || isbnBrut.length === 10 ? isbnBrut : null,
      pages: lirePages(champ(COL.pages)),
      note,
      statut,
      serie,
      tome,
      avis,
      editeur: champ(COL.editeur) || null,
      // Bookmory ne distingue pas le support : tout est marqué comme lu,
      // sans mention papier, numérique ou audio.
      format: "papier",
      dateAjout: periodes[0]?.debut ?? null,
      dateLecture: periodes.at(-1)?.fin ?? null,
      nombreLectures: periodes.length,
      periodes,
      genre: genre?.libelle ?? null,
      sousGenre: sousGenreDepuisEtiquettes(champ(COL.tags)),
      dateSortie: lireDateFr(champ(COL.datePublication)),
      prix: Number.isFinite(prix) && prix > 0 ? prix : null,
    });
  });

  return {
    livres,
    rejets,
    colonnesManquantes,
    total: Math.max(0, data.length - 2),
    datesApprochees,
    auteursMultiples,
  };
}

/** Signature du format : deux lignes d'en-tête, dont ces intitulés français. */
export function estBookmory(premieresLignes: string[][]): boolean {
  const l0 = (premieresLignes[0] ?? []).join(" ");
  const l1 = (premieresLignes[1] ?? []).join(" ");
  return (
    l0.includes("Informations sur le livre") ||
    (l1.includes("Titre") && l1.includes("Total de page"))
  );
}
