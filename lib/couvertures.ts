import { createHash } from "node:crypto";

import { memeTitre, normaliser } from "./texte";

/**
 * Récupération des couvertures.
 *
 * Deux pièges, tous deux constatés sur la bibliothèque réelle :
 *
 * 1. **Une source qui ne connaît pas un livre répond souvent 200 avec une
 *    image de remplacement**, plutôt qu'une erreur. Google Books sert ainsi
 *    la même vignette grise pour des dizaines d'ISBN. S'y fier remplirait
 *    l'étagère d'images identiques, ce qui est pire que pas d'image du tout :
 *    le repli graphique du §7, lui, encode au moins le genre. On identifie
 *    donc les images par empreinte, et on écarte celles qui se répètent.
 *
 * 2. **Les catalogues anglophones ignorent le poche français.** Sur 36 livres
 *    à ISBN restés sans image, Google n'avait que son placeholder et Open
 *    Library ne répondait pas. D'où une source interrogée par titre et
 *    auteur, seule capable d'atteindre aussi les livres sans ISBN — que la
 *    recherche laissait jusqu'ici entièrement de côté.
 */

/** Livre à illustrer. L'ISBN peut manquer : la recherche par titre reste. */
export type LivreACouvrir = {
  /** Identifiant opaque, rendu tel quel — la couche base s'y retrouve. */
  cle: string;
  isbn13: string | null;
  titre: string;
  auteur: string;
};

export type Couverture = { cle: string; url: string; empreinte: string };

/**
 * Substituts déjà rencontrés, gardés en amorce.
 *
 * La détection ne repose pas sur eux — elle est faite d'abord par répétition
 * dans le lot, ce qui la rend auto-calibrante. Ils servent au cas où un lot
 * ne contiendrait qu'un seul exemplaire du substitut.
 */
const SUBSTITUTS_CONNUS = new Set([
  "ba8cd5043eed", // « image non disponible » de Google Books, 10 794 o
  "cc7313f0f2ac", // vignette vide de Google Books, 1 269 o
  "30afe778a50a", // le même, en grand format quand `zoom` est omis, 246 264 o
]);

/** En deçà, ce n'est pas une couverture mais un pixel de remplissage. */
const TAILLE_MINIMALE = 1500;

/**
 * Délais d'attente, par source.
 *
 * Open Library est la plus courte volontairement : elle n'a jamais rendu une
 * seule couverture de cette bibliothèque, et douze sondages sur douze ont
 * expiré. La garder coûte peu tant qu'elle passe en dernier ; l'attendre
 * longtemps coûterait la vague entière.
 */
const DELAI_IMAGE = 4000;
const DELAI_RECHERCHE = 4000;
const DELAI_DERNIER_RECOURS = 2000;

async function telecharger(url: string, delaiMs = DELAI_IMAGE) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(delaiMs),
    headers: { "User-Agent": "MaBibliotheque/0.1 (suivi de lecture personnel)" },
  });
  if (!r.ok) return null;

  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength < TAILLE_MINIMALE) return null;

  const type = r.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return null;

  return {
    octets: buf.byteLength,
    empreinte: createHash("sha1").update(buf).digest("hex").slice(0, 12),
  };
}

/** Image plausible à cette adresse, écartant les substituts connus. */
async function imagePlausible(url: string, delaiMs?: number) {
  const image = await telecharger(url, delaiMs);
  if (!image) return null;
  if (SUBSTITUTS_CONNUS.has(image.empreinte)) return null;
  return image;
}

const urlGoogle = (isbn13: string) =>
  `https://books.google.com/books/content?vid=ISBN${isbn13}&printsec=frontcover&img=1&zoom=1`;

// `default=false` : sans ce paramètre, Open Library répond 200 avec une image
// « pas de couverture » au lieu du 404 qui nous renseigne.
const urlOpenLibrary = (isbn13: string) =>
  `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false`;

type Resultat = { titre: string; auteur: string; vignette: string };

/**
 * Le résultat désigne-t-il bien notre livre ?
 *
 * Une recherche par titre rend forcément des approximations, et une
 * couverture fausse est bien pire qu'une couverture absente : elle se donne
 * pour vraie, et rien à l'écran ne la dénonce. On exige donc que le titre
 * passe la règle d'appariement — celle-là même qui empêche « La femme de
 * ménage » d'avaler « La Femme de ménage voit tout » — *et* qu'un mot du nom
 * d'auteur se retrouve de part et d'autre. Le prénom seul ne suffirait pas à
 * distinguer deux homonymes, mais deux romancières nommées McFadden écrivant
 * le même titre n'existent pas.
 *
 * En cas de doute, on ne prend rien : le repli graphique est prévu pour ça.
 */
function correspond(r: Resultat, titre: string, auteur: string): boolean {
  if (!memeTitre(r.titre, titre)) return false;

  const nos = new Set(
    normaliser(auteur)
      .split(" ")
      .filter((m) => m.length >= 3),
  );
  if (nos.size === 0) return false;

  return normaliser(r.auteur)
    .split(" ")
    .some((m) => nos.has(m));
}

/**
 * Apple Books, interrogé par titre et auteur.
 *
 * Son catalogue indexe les ISBN numériques, pas ceux du poche : la recherche
 * par ISBN n'a rendu qu'un livre sur huit, là où titre + auteur en a rendu
 * six sur six. C'est donc le titre qui interroge, et `correspond` qui trie.
 *
 * On demande plusieurs résultats parce que le premier est souvent une
 * édition voisine — intégrale, version originale — et que le bon suit.
 */
async function chercherApple(
  titre: string,
  auteur: string,
): Promise<string | null> {
  const terme = encodeURIComponent(`${titre} ${auteur}`);
  const r = await fetch(
    `https://itunes.apple.com/search?country=FR&entity=ebook&limit=5&term=${terme}`,
    { signal: AbortSignal.timeout(DELAI_RECHERCHE) },
  );
  if (!r.ok) return null;

  const données = (await r.json()) as {
    results?: Array<{
      trackName?: string;
      artistName?: string;
      artworkUrl100?: string;
    }>;
  };

  for (const brut of données.results ?? []) {
    if (!brut.trackName || !brut.artistName || !brut.artworkUrl100) continue;
    const candidat = {
      titre: brut.trackName,
      auteur: brut.artistName,
      vignette: brut.artworkUrl100,
    };
    if (!correspond(candidat, titre, auteur)) continue;
    // La vignette est servie en 100 px, illisible sur une étagère. Le gabarit
    // se réécrit dans l'adresse ; Apple rend alors la même image en grand.
    return candidat.vignette.replace(/\/100x100bb\.jpg$/, "/600x600bb.jpg");
  }

  return null;
}

/**
 * Première source qui rend une image plausible pour ce livre.
 *
 * L'ordre suit ce que les sources ont réellement donné : Google Books a
 * fourni les vingt et une couvertures existantes, Apple Books atteint les
 * éditions françaises que Google ignore, Open Library ferme la marche faute
 * d'avoir jamais rien rendu.
 */
async function chercher(livre: LivreACouvrir): Promise<Couverture | null> {
  const tentatives: Array<() => Promise<{ url: string; empreinte: string } | null>> =
    [];

  if (livre.isbn13) {
    const url = urlGoogle(livre.isbn13);
    tentatives.push(async () => {
      const image = await imagePlausible(url);
      return image ? { url, empreinte: image.empreinte } : null;
    });
  }

  tentatives.push(async () => {
    const url = await chercherApple(livre.titre, livre.auteur);
    if (!url) return null;
    const image = await imagePlausible(url);
    return image ? { url, empreinte: image.empreinte } : null;
  });

  if (livre.isbn13) {
    const url = urlOpenLibrary(livre.isbn13);
    tentatives.push(async () => {
      const image = await imagePlausible(url, DELAI_DERNIER_RECOURS);
      return image ? { url, empreinte: image.empreinte } : null;
    });
  }

  for (const tenter of tentatives) {
    try {
      const trouve = await tenter();
      if (trouve) return { cle: livre.cle, ...trouve };
    } catch {
      // Source injoignable : on passe à la suivante. Une couverture absente
      // n'est pas un échec, le repli graphique est prévu pour ça.
    }
  }
  return null;
}

/**
 * Résout les couvertures d'un lot, en écartant les images partagées.
 *
 * C'est la répétition qui trahit le substitut : deux livres différents ne
 * peuvent pas avoir la même image au bit près. La détection s'ajuste donc
 * d'elle-même, sans dépendre d'une liste d'empreintes à maintenir.
 */
export async function resoudreCouvertures(
  livres: LivreACouvrir[],
  options: {
    /** Plafond de débit : Open Library coupe au-delà de 10 requêtes/seconde */
    pauseMs?: number;
    /**
     * Budget de temps, en millisecondes.
     *
     * C'est lui qui borne la vague, pas le nombre de livres : un catalogue
     * lent transforme vingt-cinq recherches en plusieurs minutes, et la
     * fonction serveur est coupée bien avant — la vague entière est alors
     * perdue, y compris les couvertures déjà trouvées. On rend donc la main
     * de nous-mêmes, en disant jusqu'où on est allé.
     */
    budgetMs?: number;
  } = {},
): Promise<{ trouvees: Couverture[]; substituts: number; examines: number }> {
  const { pauseMs = 120, budgetMs = 20_000 } = options;
  const brut: Couverture[] = [];
  const debut = Date.now();
  let examines = 0;

  for (const livre of livres) {
    const c = await chercher(livre);
    examines += 1;
    if (c) brut.push(c);
    // Au moins un livre est toujours traité, sinon une vague trop lente
    // n'avancerait jamais et la boucle appelante tournerait à vide.
    if (Date.now() - debut > budgetMs) break;
    await new Promise((r) => setTimeout(r, pauseMs));
  }

  const compte = new Map<string, number>();
  for (const c of brut) compte.set(c.empreinte, (compte.get(c.empreinte) ?? 0) + 1);

  const trouvees = brut.filter((c) => compte.get(c.empreinte) === 1);

  return { trouvees, substituts: brut.length - trouvees.length, examines };
}
