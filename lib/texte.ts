/**
 * Normalisation de texte pour comparaison.
 *
 * Trois copies de cette logique cohabitaient — genres, parseur Kindle,
 * appariement — et l'une d'elles ignorait les ligatures. Une seule
 * implémentation évite qu'un correctif n'en corrige qu'une sur trois.
 */

const DIACRITIQUES = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Ligatures et caractères que `NFD` ne décompose pas.
 *
 * C'est le piège du français : « sœurs » et « soeurs » désignent le même
 * mot, mais `normalize("NFD")` laisse le « œ » intact. Il disparaît alors
 * avec la ponctuation, et « Les sept sœurs » devient « les sept s urs ».
 */
const LIGATURES: Array<[RegExp, string]> = [
  [/œ/g, "oe"],
  [/æ/g, "ae"],
  [/ﬁ/g, "fi"],
  [/ﬂ/g, "fl"],
  [/ß/g, "ss"],
  [/ø/g, "o"],
  [/đ/g, "d"],
  [/ł/g, "l"],
  // Apostrophes typographiques : « l'étranger » et « l'étranger »
  [/[’‘‛]/g, "'"],
];

/** Minuscules, sans accent ni ligature, ponctuation réduite à des espaces. */
export function normaliser(valeur: string): string {
  let v = valeur.toLowerCase();
  for (const [motif, remplacement] of LIGATURES) v = v.replace(motif, remplacement);

  return v
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Minuscules sans accent ni ligature, mais **ponctuation conservée**. */
function sansAccent(valeur: string): string {
  let v = valeur.toLowerCase();
  for (const [motif, remplacement] of LIGATURES) v = v.replace(motif, remplacement);
  return v
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .replace(/\s+/g, " ")
    .trim();
}

function decoderEntites(s: string): string {
  return (
    s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      // `&amp;` en dernier : le décoder plus tôt ferait renaître une entité
      // depuis « &amp;lt; » et le second tour la prendrait pour du balisage.
      .replace(/&amp;/g, "&")
  );
}

function sansBalises(s: string): string {
  return (
    s
      // Les sauts de bloc deviennent des retours à la ligne. Les effacer sans
      // rien mettre à la place colle les phrases : « qui peuvent nous faire le
      // plus de mal.Lily Blossom Bloom n'a pas eu… »
      .replace(/<\s*(br|hr)\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
  );
}

/**
 * Texte lisible depuis le HTML d'un catalogue.
 *
 * Les descriptions d'Apple Books arrivent balisées, et pas toujours de la
 * même façon : `<br />` bruts chez les uns, `&lt;br /&gt;` échappés chez les
 * autres — parfois les deux dans la même fiche. Une seule passe laisserait
 * donc du balisage visible à l'écran, d'où le second tour.
 */
export function texteDepuisHtml(brut: string): string {
  let v = brut;
  // Deux tours : le premier découvre le balisage échappé, le second le traite.
  for (let i = 0; i < 2; i += 1) v = decoderEntites(sansBalises(v));

  return v
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Marqueurs de sous-titre ou de mention d'édition.
 *
 * C'est le cœur de la règle : un titre plus long n'est le même ouvrage que
 * s'il enchaîne sur une ponctuation. Sans cette exigence, « La femme de
 * ménage » avalait « La Femme de ménage voit tout » et « La Femme de ménage
 * se marie » — trois romans distincts d'une même autrice, réduits à un seul.
 * Les suites prolongent le titre du premier tome, c'est la règle et non
 * l'exception.
 */
const SUITE_SOUS_TITRE = /^\s*[:(\[–—,;./-]/;

/**
 * Deux titres désignent-ils le même ouvrage ?
 *
 * L'égalité normalisée d'abord — elle absorbe casse, accents et ligatures.
 * À défaut, un titre peut être le début de l'autre, mais seulement si la
 * suite s'ouvre sur une ponctuation : « Dune : le cycle » oui, « La femme de
 * ménage voit tout » non.
 *
 * Le plancher de trois caractères reste, pour que « Ça » n'aille pas
 * s'apparier au premier titre venu.
 */
export function memeTitre(a: string, b: string): boolean {
  const x = normaliser(a);
  const y = normaliser(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 3) return false;

  const [court, long] =
    sansAccent(a).length <= sansAccent(b).length
      ? [sansAccent(a), sansAccent(b)]
      : [sansAccent(b), sansAccent(a)];

  if (!long.startsWith(court)) return false;
  return SUITE_SOUS_TITRE.test(long.slice(court.length));
}
