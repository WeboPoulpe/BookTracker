import Papa from "papaparse";

import { decomposerTitre } from "./titres";
import type { Statut } from "@/db/schema";

/**
 * Parseur et mapping du CSV Goodreads (§6).
 *
 * Goodreads est le pivot d'échange de l'écosystème : l'import doit être sans
 * perte, et surtout jamais silencieux. Chaque ligne rejetée sort avec son
 * motif, pour qu'on sache exactement ce qui n'est pas remonté.
 */

export type LigneGoodreads = Record<string, string>;

export type LivreImporte = {
  titre: string;
  auteur: string;
  isbn13: string | null;
  pages: number | null;
  note: number | null;
  statut: Statut;
  serie: string | null;
  tome: number | null;
  avis: string | null;
  editeur: string | null;
  format: "papier" | "ebook" | "audio";
  dateAjout: string | null;
  dateLecture: string | null;
  /** Nombre de lectures déclaré par le catalogue — sert à créer l'historique */
  nombreLectures: number;

  /* Champs qu'apporte StoryGraph et que Goodreads ignore. Facultatifs, pour
     que les deux parseurs produisent le même type sans que Goodreads ait à
     inventer des valeurs. */
  /** Périodes de lecture datées — permet de restituer les relectures */
  periodes?: Array<{ debut: string | null; fin: string }>;
  humeur?: string | null;
  emoji?: string | null;
  axeIntrigue?: number | null;
  axePersonnages?: number | null;
  axeThemes?: number | null;
};

export type Rejet = { ligne: number; titre: string; motif: string };

export type Analyse = {
  livres: LivreImporte[];
  rejets: Rejet[];
  /** Colonnes attendues absentes du fichier */
  colonnesManquantes: string[];
  total: number;
};

const COLONNES_ATTENDUES = [
  "Title",
  "Author",
  "ISBN13",
  "Number of Pages",
  "My Rating",
  "Exclusive Shelf",
  "Bookshelves",
  "Date Added",
  "Date Read",
  "My Review",
];

/** `="9782365593823"` → `9782365593823`. Goodreads enrobe pour Excel. */
export function nettoyerIsbn(brut: string | undefined): string | null {
  if (!brut) return null;
  const propre = brut.replace(/^="?|"?$/g, "").replace(/[^0-9Xx]/g, "");
  if (propre.length !== 13 && propre.length !== 10) return null;
  return propre;
}

/** Goodreads écrit `2024/03/15`. On sort du `YYYY-MM-DD` prêt pour Postgres. */
export function normaliserDate(brut: string | undefined): string | null {
  if (!brut?.trim()) return null;
  const m = brut.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) return null;
  const [, a, mo, j] = m;
  const iso = `${a}-${mo.padStart(2, "0")}-${j.padStart(2, "0")}`;
  return Number.isNaN(new Date(`${iso}T12:00:00`).getTime()) ? null : iso;
}

/**
 * `Exclusive Shelf` donne le statut principal, mais l'abandon vit dans
 * `Bookshelves` : Goodreads n'a pas d'étagère « abandonné » native, les
 * lecteurs se fabriquent une étagère `abandoned` ou `dnf`.
 */
export function deduireStatut(
  etagereExclusive: string | undefined,
  etageres: string | undefined,
): Statut {
  const secondaires = (etageres ?? "").toLowerCase();
  if (/\b(abandoned|dnf|did-not-finish|abandonne|abandonné)\b/.test(secondaires)) {
    return "abandonne";
  }
  if (/\b(paused|on-hold|en-pause)\b/.test(secondaires)) {
    return "en_pause";
  }

  switch ((etagereExclusive ?? "").trim().toLowerCase()) {
    case "read":
      return "lu";
    case "currently-reading":
      return "en_cours";
    case "to-read":
      return "a_lire";
    default:
      return "a_lire";
  }
}

/** `Binding` renseigne le support quand il est présent. */
function deduireFormat(binding: string | undefined): LivreImporte["format"] {
  const b = (binding ?? "").toLowerCase();
  if (/audio|audible|cd/.test(b)) return "audio";
  if (/kindle|ebook|e-book|epub|numérique/.test(b)) return "ebook";
  return "papier";
}

function entier(brut: string | undefined): number | null {
  if (!brut?.trim()) return null;
  const n = Number.parseInt(brut.replace(/\s/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function analyser(csv: string): Analyse {
  const { data, meta } = Papa.parse<LigneGoodreads>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const colonnes = meta.fields ?? [];
  const colonnesManquantes = COLONNES_ATTENDUES.filter(
    (c) => !colonnes.includes(c),
  );

  const livres: LivreImporte[] = [];
  const rejets: Rejet[] = [];

  data.forEach((ligne, i) => {
    // +2 : l'en-tête occupe la ligne 1, et les tableurs comptent depuis 1
    const numero = i + 2;
    const titreBrut = (ligne["Title"] ?? "").trim();

    if (!titreBrut) {
      rejets.push({ ligne: numero, titre: "—", motif: "Titre absent" });
      return;
    }

    const { titre, serie, tome } = decomposerTitre(titreBrut);

    // My Rating = 0 signifie « non noté », pas « zéro étoile ».
    // Confondre les deux fabrique une bibliothèque entière notée 0/5.
    const noteBrute = entier(ligne["My Rating"]);
    const note = noteBrute && noteBrute > 0 ? noteBrute : null;

    livres.push({
      titre,
      auteur: (ligne["Author"] ?? "").trim() || "Auteur inconnu",
      isbn13: nettoyerIsbn(ligne["ISBN13"]) ?? nettoyerIsbn(ligne["ISBN"]),
      pages: entier(ligne["Number of Pages"]),
      note,
      statut: deduireStatut(ligne["Exclusive Shelf"], ligne["Bookshelves"]),
      serie,
      tome,
      avis: (ligne["My Review"] ?? "").trim() || null,
      editeur: (ligne["Publisher"] ?? "").trim() || null,
      format: deduireFormat(ligne["Binding"]),
      dateAjout: normaliserDate(ligne["Date Added"]),
      dateLecture: normaliserDate(ligne["Date Read"]),
      nombreLectures: entier(ligne["Read Count"]) ?? 0,
    });
  });

  return { livres, rejets, colonnesManquantes, total: data.length };
}

/* ── Export ──────────────────────────────────────────────────────────────── */

export type LivreExport = {
  titre: string;
  auteur: string;
  isbn13: string | null;
  pages: number | null;
  note: number | null;
  statut: Statut | null;
  serieNom: string | null;
  tome: number | null;
  avis: string | null;
  dateAjout: string | null;
  dateLecture: string | null;
};

const STATUT_VERS_ETAGERE: Record<Statut, string> = {
  lu: "read",
  en_cours: "currently-reading",
  a_lire: "to-read",
  // Goodreads n'a pas d'étagère native : on reste sur `read` et on marque
  // l'état réel dans Bookshelves, exactement comme le font les lecteurs.
  abandonne: "read",
  en_pause: "currently-reading",
};

const STATUT_VERS_ETAGERES: Partial<Record<Statut, string>> = {
  abandonne: "abandoned",
  en_pause: "on-hold",
};

/**
 * Produit un CSV relisible par Goodreads.
 *
 * L'export n'est pas une case à cocher : c'est la garantie qu'on peut partir
 * avec ses données. Il doit donc rester importable ailleurs, pas seulement
 * ici.
 */
export function versCsvGoodreads(livres: LivreExport[]): string {
  const lignes = livres.map((l) => ({
    Title: l.serieNom && l.tome != null
      ? `${l.titre} (${l.serieNom}, #${l.tome})`
      : l.titre,
    Author: l.auteur,
    ISBN: "",
    // Le préfixe `="..."` empêche Excel de manger les zéros de tête
    ISBN13: l.isbn13 ? `="${l.isbn13}"` : "",
    "My Rating": l.note != null ? String(Math.round(l.note)) : "0",
    "Number of Pages": l.pages != null ? String(l.pages) : "",
    "Exclusive Shelf": l.statut ? STATUT_VERS_ETAGERE[l.statut] : "to-read",
    Bookshelves: (l.statut && STATUT_VERS_ETAGERES[l.statut]) ?? "",
    "Date Added": l.dateAjout?.replace(/-/g, "/") ?? "",
    "Date Read": l.dateLecture?.replace(/-/g, "/") ?? "",
    "My Review": l.avis ?? "",
  }));

  return Papa.unparse(lignes, { header: true, newline: "\r\n" });
}
