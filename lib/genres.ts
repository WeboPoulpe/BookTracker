/**
 * Référentiel des genres → couleur de tranche.
 *
 * Les teintes restent dans le registre pastel de la charte (§7) : sur une
 * étagère de cent tranches, des couleurs saturées donneraient un nuancier de
 * peinture, pas une bibliothèque. On joue donc sur la teinte, pas l'intensité.
 */

export type Genre = {
  cle: string;
  libelle: string;
  /** Couleur de la tranche */
  couleur: string;
  /** Texte lisible posé sur la tranche */
  encre: string;
};

export const GENRES: Genre[] = [
  { cle: "romance", libelle: "Romance", couleur: "#F2C4D8", encre: "#5C2740" },
  { cle: "fantasy", libelle: "Fantasy", couleur: "#C9BCEC", encre: "#33265C" },
  { cle: "sf", libelle: "Science-fiction", couleur: "#A8C0E8", encre: "#1E3459" },
  { cle: "thriller", libelle: "Thriller", couleur: "#4A4863", encre: "#EFEDF6" },
  { cle: "policier", libelle: "Policier", couleur: "#7D8AA8", encre: "#F2F4F9" },
  { cle: "horreur", libelle: "Horreur", couleur: "#2B2233", encre: "#E7D9EC" },
  { cle: "contemporain", libelle: "Contemporain", couleur: "#F6D9B8", encre: "#5C3A18" },
  { cle: "historique", libelle: "Historique", couleur: "#D9C7A3", encre: "#4A3A1C" },
  { cle: "classique", libelle: "Classique", couleur: "#B9A88C", encre: "#332918" },
  { cle: "nature", libelle: "Nature", couleur: "#BBD4C4", encre: "#1F4033" },
  { cle: "essai", libelle: "Essai", couleur: "#CFD6DC", encre: "#2C3844" },
  { cle: "biographie", libelle: "Biographie", couleur: "#E8CFA0", encre: "#4C3A11" },
  { cle: "jeunesse", libelle: "Jeunesse", couleur: "#FBE7A1", encre: "#5A4407" },
  { cle: "bd", libelle: "BD & manga", couleur: "#F4B9A8", encre: "#5E2A1B" },
  { cle: "poesie", libelle: "Poésie", couleur: "#E3D4F0", encre: "#3E2A54" },
  { cle: "developpement", libelle: "Développement perso", couleur: "#AEDBD3", encre: "#12403A" },
];

const PAR_CLE = new Map(GENRES.map((g) => [g.cle, g]));

/** Repli neutre : une tranche sans genre reste dans la famille encre. */
export const GENRE_INCONNU: Genre = {
  cle: "inconnu",
  libelle: "Sans genre",
  couleur: "#C9C7D6",
  encre: "#2C2A3E",
};

/** Synonymes courants, dont ceux que Goodreads renvoie en anglais. */
const ALIAS: Record<string, string> = {
  "science fiction": "sf",
  "science-fiction": "sf",
  "sci-fi": "sf",
  scifi: "sf",
  fantastique: "fantasy",
  fantaisie: "fantasy",
  polar: "policier",
  crime: "policier",
  mystery: "policier",
  suspense: "thriller",
  horror: "horreur",
  romantic: "romance",
  "romance contemporaine": "romance",
  "new adult": "romance",
  "young adult": "jeunesse",
  ya: "jeunesse",
  enfant: "jeunesse",
  "littérature jeunesse": "jeunesse",
  manga: "bd",
  comics: "bd",
  "bande dessinée": "bd",
  roman: "contemporain",
  "littérature": "contemporain",
  fiction: "contemporain",
  "non-fiction": "essai",
  nonfiction: "essai",
  documentaire: "essai",
  history: "historique",
  histoire: "historique",
  biography: "biographie",
  mémoires: "biographie",
  memoir: "biographie",
  classics: "classique",
  poetry: "poesie",
  "self-help": "developpement",
  "développement personnel": "developpement",
  nature: "nature",
  écologie: "nature",
};

// Construite depuis une source ASCII : écrire la plage de diacritiques en
// caractères combinants littéraux la rend invisible et cassable au moindre
// changement d'encodage du fichier.
const DIACRITIQUES = new RegExp("[\\u0300-\\u036f]", "g");

function normaliser(valeur: string) {
  return valeur.trim().toLowerCase().normalize("NFD").replace(DIACRITIQUES, "");
}

/**
 * Résout un genre écrit à la main. Tolère la casse, les accents et les
 * libellés anglais de Goodreads — un import ne doit jamais produire une
 * bibliothèque entièrement grise.
 */
export function resoudreGenre(valeur?: string | null): Genre {
  if (!valeur) return GENRE_INCONNU;

  const brut = valeur.trim().toLowerCase();
  const sansAccent = normaliser(valeur);

  const direct = PAR_CLE.get(sansAccent) ?? PAR_CLE.get(brut);
  if (direct) return direct;

  const parAlias = ALIAS[brut] ?? ALIAS[sansAccent];
  if (parAlias) return PAR_CLE.get(parAlias) ?? GENRE_INCONNU;

  // Correspondance partielle : « thriller psychologique » → thriller
  const partiel = GENRES.find(
    (g) =>
      sansAccent.includes(normaliser(g.libelle)) ||
      normaliser(g.libelle).includes(sansAccent),
  );
  if (partiel) return partiel;

  const aliasPartiel = Object.keys(ALIAS).find((a) =>
    sansAccent.includes(normaliser(a)),
  );
  if (aliasPartiel) return PAR_CLE.get(ALIAS[aliasPartiel]) ?? GENRE_INCONNU;

  return GENRE_INCONNU;
}

/**
 * Largeur de tranche proportionnelle au nombre de pages.
 * Bornée : un pavé de 1 200 pages ne doit pas manger l'écran, et une
 * plaquette de 60 pages doit rester tapable (cible de 44 px, §7).
 */
export function largeurTranche(pages?: number | null): number {
  const MIN = 26;
  const MAX = 62;
  const REFERENCE = 320; // roman médian
  if (!pages || pages <= 0) return 34;
  // Racine carrée : l'écart 200→400 doit se voir davantage que 900→1100
  const ratio = Math.sqrt(pages / REFERENCE);
  return Math.round(Math.min(MAX, Math.max(MIN, 34 * ratio)));
}
