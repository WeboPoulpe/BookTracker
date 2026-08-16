import { resoudreGenre, type Genre } from "./genres";

/**
 * Déduction du genre depuis les étiquettes d'un catalogue.
 *
 * Bookmory et StoryGraph attachent des étiquettes anglaises en casse chameau
 * — `#HistoricalFiction`, `#MysteryThriller` — là où ni l'un ni l'autre ne
 * renseigne de genre. C'est la seule source disponible, et elle est bonne :
 * une bibliothèque importée sans genre donne une étagère grise et des
 * statistiques vides.
 *
 * L'ordre de cette liste est le classement par spécificité, pas un détail :
 * un livre étiqueté `#Thriller #Fiction` est un thriller, pas un roman
 * contemporain, et `#Fiction` accompagne à peu près tout.
 */
const CORRESPONDANCES: Array<[RegExp, string]> = [
  // Sous-genres et genres précis d'abord
  [/^romantasy$/i, "fantasy"],
  [/^(fantasy|fantasyromance|magic|fae|highfantasy|urbanfantasy)$/i, "fantasy"],
  [/^(sciencefiction|scifi|dystopia|dystopian|spaceopera)$/i, "sf"],
  [/^(horror|paranormal|gothic)$/i, "horreur"],
  [
    /^(thriller|mysterythriller|psychologicalthriller|suspense|romanticsuspense)$/i,
    "thriller",
  ],
  [/^(mystery|crime|truecrime|detective|cozymystery)$/i, "policier"],
  [/^(historicalfiction|historical|worldwarii|holocaust|war|history)$/i, "historique"],
  [
    /^(romance|historicalromance|contemporaryromance|darkromance|newadult|chicklit|love|fakedating|forcedproximity)$/i,
    "romance",
  ],
  [/^(youngadult|teen|middlegrade|children|childrens)$/i, "jeunesse"],
  [/^(graphicnovels?|comics|manga|bandedessinee)$/i, "bd"],
  [/^poetry$/i, "poesie"],
  [/^classics?$/i, "classique"],
  [
    /^(memoir|biography|biographymemoir|autobiography|diary)$/i,
    "biographie",
  ],
  [
    /^(selfhelp|personaldevelopment|productivity|mindfulness|spirituality)$/i,
    "developpement",
  ],
  [
    /^(business|finance|money|personalfinance|entrepreneurship|economics)$/i,
    "essai",
  ],
  [
    /^(nonfiction|psychology|philosophy|science|politics|feminism|sociology|essays)$/i,
    "essai",
  ],
  [/^(nature|travel|environment|adventure)$/i, "nature"],
  // Les plus génériques en dernier : ils accompagnent presque tout
  [
    /^(literaryfiction|frenchliterature|contemporary|fiction|roman|novels?|adultfiction|adult|realisticfiction|drama|bookclub)$/i,
    "contemporain",
  ],
];

/**
 * Résout un genre depuis une chaîne d'étiquettes.
 *
 * Accepte les formats `#Thriller #Mystery` de Bookmory comme les listes
 * séparées par des virgules.
 */
export function genreDepuisEtiquettes(brut?: string | null): Genre | null {
  if (!brut?.trim()) return null;

  const etiquettes = brut
    .split(/[#,;]/)
    .map((e) => e.trim().replace(/\s+/g, ""))
    .filter(Boolean);

  for (const [motif, cle] of CORRESPONDANCES) {
    if (etiquettes.some((e) => motif.test(e))) {
      const g = resoudreGenre(cle);
      if (g.cle !== "inconnu") return g;
    }
  }

  // Dernier recours : l'étiquette telle quelle, au cas où elle serait déjà
  // un libellé du référentiel.
  for (const e of etiquettes) {
    const g = resoudreGenre(e);
    if (g.cle !== "inconnu") return g;
  }

  return null;
}

/**
 * Sous-genre : la première étiquette reconnue qui n'est *pas* celle ayant
 * donné le genre. `#Thriller #PsychologicalThriller` doit ranger le livre en
 * thriller psychologique, pas répéter « Thriller ».
 */
const SOUS_GENRES_ETIQUETTES: Record<string, string> = {
  psychologicalthriller: "Thriller psychologique",
  romanticsuspense: "Thriller psychologique",
  cozymystery: "Cosy mystery",
  truecrime: "True crime",
  historicalromance: "Romance historique",
  contemporaryromance: "Romance contemporaine",
  darkromance: "Dark romance",
  romantasy: "Romantasy",
  newadult: "New adult",
  youngadult: "Young adult",
  dystopia: "Dystopie",
  dystopian: "Dystopie",
  spaceopera: "Space opera",
  worldwarii: "Seconde Guerre mondiale",
  holocaust: "Seconde Guerre mondiale",
  memoir: "Mémoires",
  autobiography: "Autobiographie",
  selfhelp: "Bien-être",
  personalfinance: "Finances personnelles",
  productivity: "Productivité",
  feminism: "Féminisme",
  philosophy: "Philosophie",
  psychology: "Psychologie",
  travel: "Récit de voyage",
  graphicnovel: "Roman graphique",
  graphicnovels: "Roman graphique",
  manga: "Manga shōnen",
  chicklit: "Feel-good",
  literaryfiction: "Littérature blanche",
  classics: "Classique français",
};

export function sousGenreDepuisEtiquettes(brut?: string | null): string | null {
  if (!brut?.trim()) return null;

  const etiquettes = brut
    .split(/[#,;]/)
    .map((e) => e.trim().replace(/\s+/g, "").toLowerCase())
    .filter(Boolean);

  for (const e of etiquettes) {
    const s = SOUS_GENRES_ETIQUETTES[e];
    if (s) return s;
  }
  return null;
}
