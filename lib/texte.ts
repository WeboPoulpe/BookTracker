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

/**
 * Deux titres désignent-ils le même ouvrage ?
 *
 * L'égalité stricte échoue trop souvent : la liseuse porte le sous-titre, la
 * bibliothèque la mention d'édition. On accepte donc qu'un titre soit le
 * début de l'autre — mais sur une frontière de mot, et pas avant trois
 * caractères. Sans la frontière, « ça » apparierait « cassandra » ; sans le
 * plancher, deux lettres suffiraient à tout confondre.
 */
export function memeTitre(a: string, b: string): boolean {
  const x = normaliser(a);
  const y = normaliser(b);
  if (!x || !y) return false;
  if (x === y) return true;

  const [court, long] = x.length <= y.length ? [x, y] : [y, x];
  if (court.length < 3) return false;

  return long.startsWith(`${court} `);
}
