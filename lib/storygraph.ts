import Papa from "papaparse";

import type { LivreImporte, Rejet } from "./goodreads";
import { HUMEURS } from "./notation";
import { decomposerTitre } from "./titres";

/**
 * Parseur de l'export CSV StoryGraph.
 *
 * StoryGraph a remplacé Goodreads pour beaucoup de lectrices depuis
 * qu'Amazon a fermé l'API de ce dernier. Son export est plus riche — humeurs,
 * rythme, questions sur les personnages — mais il place aussi des
 * informations là où on ne les attend pas, l'abandon en premier lieu.
 */

export type AnalyseStorygraph = {
  livres: LivreImporte[];
  rejets: Rejet[];
  colonnesManquantes: string[];
  total: number;
  /** Livres lus dont la date de lecture manque : la date d'ajout fera foi */
  datesApprochees: number;
  /** Livres à plusieurs auteurs : seul le premier est retenu */
  auteursMultiples: number;
};

const COLONNES_ATTENDUES = [
  "Title",
  "Authors",
  "ISBN/UID",
  "Format",
  "Read Status",
  "Date Added",
  "Last Date Read",
  "Dates Read",
  "Star Rating",
  "Review",
  "Tags",
];

/** Signature du format : ces colonnes n'existent que chez StoryGraph. */
export function estStorygraph(colonnes: string[]): boolean {
  return (
    colonnes.includes("Read Status") &&
    (colonnes.includes("Moods") || colonnes.includes("Star Rating"))
  );
}

/** `2026/08/05` → `2026-08-05`. */
function normaliserDate(brut: string | undefined): string | null {
  if (!brut?.trim()) return null;
  const m = brut.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!m) return null;
  const [, a, mo, j] = m;
  const iso = `${a}-${mo.padStart(2, "0")}-${j.padStart(2, "0")}`;
  return Number.isNaN(new Date(`${iso}T12:00:00`).getTime()) ? null : iso;
}

export type Periode = { debut: string | null; fin: string };

/**
 * Décode le champ `Dates Read`, qui encode *plusieurs lectures*.
 *
 *   « 2026/08/05-2026/08/09 »              → une lecture, du 5 au 9
 *   « 2024/01/31-2025/03/30, 2025/03/30 »  → deux lectures
 *   « 2025/12/13 »                         → une lecture, fin seule
 *
 * C'est ce qui permet de restituer les relectures : la colonne `Read Count`
 * dit combien, mais seule celle-ci dit quand.
 */
export function lirePeriodes(brut: string | undefined): Periode[] {
  if (!brut?.trim()) return [];

  const periodes: Periode[] = [];

  for (const morceau of brut.split(",")) {
    const t = morceau.trim();
    if (!t) continue;

    // Le séparateur de plage est un tiret entre deux dates complètes.
    const plage = t.match(
      /^(\d{4}[/-]\d{1,2}[/-]\d{1,2})\s*-\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2})$/,
    );
    if (plage) {
      const debut = normaliserDate(plage[1]);
      const fin = normaliserDate(plage[2]);
      if (fin) periodes.push({ debut, fin });
      continue;
    }

    const seule = normaliserDate(t);
    if (seule) periodes.push({ debut: null, fin: seule });
  }

  return periodes;
}

const FORMATS: Record<string, LivreImporte["format"]> = {
  paperback: "papier",
  hardcover: "papier",
  "mass market paperback": "papier",
  digital: "ebook",
  ebook: "ebook",
  kindle: "ebook",
  audio: "audio",
  audiobook: "audio",
};

/**
 * L'abandon ne vit pas dans `Read Status`.
 *
 * StoryGraph n'a pas d'état « abandonné » exporté : les lectrices le
 * marquent par une étiquette. Trois livres de l'export testé sont ainsi
 * `read` **et** `abandoned` — les compter comme lus fausserait le taux
 * d'abandon autant que le total.
 */
function deduireStatut(
  statut: string | undefined,
  tags: string | undefined,
): LivreImporte["statut"] {
  if (/\b(abandoned|dnf|did-not-finish)\b/i.test(tags ?? "")) return "abandonne";
  if (/\b(paused|on-hold)\b/i.test(tags ?? "")) return "en_pause";

  switch ((statut ?? "").trim().toLowerCase()) {
    case "read":
      return "lu";
    case "currently-reading":
    case "currently reading":
      return "en_cours";
    case "did-not-finish":
      return "abandonne";
    default:
      return "a_lire";
  }
}

/**
 * Retient un seul auteur.
 *
 * StoryGraph liste parfois la traductrice avant l'autrice — « Fabienne
 * Duvigneau, Lucinda Riley » pour *Les Sept Sœurs*. Rien dans le fichier ne
 * permet de les distinguer quand la colonne `Contributors` est vide : on
 * écarte donc ceux qui y figurent, on déduplique, et on signale le reste à
 * l'écran pour correction.
 */
export function choisirAuteur(
  auteurs: string | undefined,
  contributeurs: string | undefined,
): { auteur: string; multiple: boolean } {
  const liste = (auteurs ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  if (liste.length === 0) return { auteur: "Auteur inconnu", multiple: false };

  const roles = (contributeurs ?? "").toLowerCase();
  const sansRole = liste.filter((a) => !roles.includes(a.toLowerCase()));
  const candidats = sansRole.length > 0 ? sansRole : liste;

  // « Marie-Claude Delahaye, Marie-Claude Delahaye » : le même nom deux fois.
  const uniques = [...new Set(candidats)];

  return { auteur: uniques[0], multiple: uniques.length > 1 };
}

/** Humeurs StoryGraph → humeur de l'app, sur la première correspondance. */
const HUMEUR_DEPUIS: Record<string, string> = {
  emotional: "Bouleversant",
  sad: "Déchirant",
  dark: "Troublant",
  tense: "Haletant",
  mysterious: "Troublant",
  adventurous: "Haletant",
  challenging: "Vertigineux",
  hopeful: "Doux",
  inspiring: "Doux",
  lighthearted: "Doux",
  relaxing: "Apaisant",
  funny: "Savoureux",
  reflective: "Troublant",
};

function lireHumeur(moods: string | undefined) {
  for (const m of (moods ?? "").split(",").map((x) => x.trim().toLowerCase())) {
    const mot = HUMEUR_DEPUIS[m];
    if (!mot) continue;
    const trouvee = HUMEURS.find((h) => h.mot === mot);
    if (trouvee) return { humeur: trouvee.mot, emoji: trouvee.emoji };
  }
  return { humeur: null, emoji: null };
}

const OUI_NON: Record<string, number> = {
  yes: 5,
  no: 2,
  "it's complicated": 3,
};

const RYTHME: Record<string, number> = { slow: 2, medium: 3, fast: 5 };

function entier(brut: string | undefined): number | null {
  if (!brut?.trim()) return null;
  const n = Number.parseFloat(brut);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function analyserStorygraph(csv: string): AnalyseStorygraph {
  const { data, meta } = Papa.parse<Record<string, string>>(csv, {
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
  let datesApprochees = 0;
  let auteursMultiples = 0;

  data.forEach((ligne, i) => {
    const numero = i + 2;
    const titreBrut = (ligne["Title"] ?? "").trim();

    if (!titreBrut) {
      rejets.push({ ligne: numero, titre: "—", motif: "Titre absent" });
      return;
    }

    const { titre, serie, tome } = decomposerTitre(titreBrut);
    const { auteur, multiple } = choisirAuteur(
      ligne["Authors"],
      ligne["Contributors"],
    );
    if (multiple) auteursMultiples += 1;

    const statut = deduireStatut(ligne["Read Status"], ligne["Tags"]);

    // Un ASIN Kindle (« B0BN8H95CW ») n'est pas un ISBN : le laisser passer
    // produirait des couvertures introuvables et un export illisible.
    const uid = (ligne["ISBN/UID"] ?? "").replace(/[^0-9Xx]/g, "");
    const isbn13 = uid.length === 13 || uid.length === 10 ? uid : null;

    const periodes = lirePeriodes(ligne["Dates Read"]);
    const derniere = normaliserDate(ligne["Last Date Read"]);
    const ajout = normaliserDate(ligne["Date Added"]);

    if (periodes.length === 0 && derniere) {
      periodes.push({ debut: null, fin: derniere });
    }

    // Repli sur la date d'ajout : sans lui, la moitié des livres lus
    // n'auraient aucune lecture et disparaîtraient des statistiques. C'est
    // une approximation, annoncée comme telle avant confirmation.
    if (periodes.length === 0 && statut === "lu" && ajout) {
      periodes.push({ debut: null, fin: ajout });
      datesApprochees += 1;
    }

    const { humeur, emoji } = lireHumeur(ligne["Moods"]);
    const note = entier(ligne["Star Rating"]);

    livres.push({
      titre,
      auteur,
      isbn13,
      pages: null,
      note: note && note > 0 ? note : null,
      statut,
      serie,
      tome,
      avis: (ligne["Review"] ?? "").trim() || null,
      editeur: null,
      format:
        FORMATS[(ligne["Format"] ?? "").trim().toLowerCase()] ?? "papier",
      dateAjout: periodes[0]?.debut ?? ajout,
      dateLecture: periodes.at(-1)?.fin ?? null,
      nombreLectures: entier(ligne["Read Count"]) ?? periodes.length,
      periodes,
      humeur,
      emoji,
      axeIntrigue: RYTHME[(ligne["Pace"] ?? "").trim().toLowerCase()] ?? null,
      axePersonnages:
        OUI_NON[
          (ligne["Strong Character Development?"] ?? "").trim().toLowerCase()
        ] ?? null,
      axeThemes:
        OUI_NON[(ligne["Diverse Characters?"] ?? "").trim().toLowerCase()] ??
        null,
    });
  });

  return {
    livres,
    rejets,
    colonnesManquantes,
    total: data.length,
    datesApprochees,
    auteursMultiples,
  };
}
