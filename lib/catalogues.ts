import { createHash } from "node:crypto";

import { memeTitre, normaliser, texteDepuisHtml } from "./texte";

/**
 * Ce que les catalogues peuvent apporter à une fiche : la couverture, et la
 * quatrième de couverture.
 *
 * Trois pièges, tous constatés sur la bibliothèque réelle :
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
 *    auteur, seule capable d'atteindre aussi les livres sans ISBN.
 *
 * 3. **Le texte arrive balisé**, et pas toujours de la même façon — voir
 *    `texteDepuisHtml`.
 *
 * Une seule interrogation d'Apple rapporte les deux : les demander
 * séparément doublerait les requêtes sans rien apprendre de plus.
 */

/** Livre à compléter, et ce qui lui manque. */
export type LivreAEnrichir = {
  /** Identifiant opaque, rendu tel quel — la couche base s'y retrouve. */
  cle: string;
  isbn13: string | null;
  titre: string;
  auteur: string;
  besoinCouverture: boolean;
  besoinSynopsis: boolean;
};

export type Apport = {
  cle: string;
  couverture?: { url: string; empreinte: string };
  synopsis?: string;
};

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
 * Un texte plus court n'est pas une quatrième de couverture.
 *
 * Certaines fiches ne portent qu'une mention d'édition — « Nouvelle
 * traduction », « Édition collector ». La poser en synopsis ferait croire à
 * un résumé et masquerait le champ vide qu'on aurait su remplir à la main.
 */
const SYNOPSIS_MINIMAL = 80;

/**
 * Au-delà, ce n'est plus un synopsis mais un dossier de presse.
 *
 * Coupé sur une frontière de phrase plutôt qu'au caractère près : un texte
 * tranché en plein mot se lit comme une donnée abîmée.
 */
const SYNOPSIS_MAXIMAL = 4000;

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
  return { url, empreinte: image.empreinte };
}

const urlGoogle = (isbn13: string) =>
  `https://books.google.com/books/content?vid=ISBN${isbn13}&printsec=frontcover&img=1&zoom=1`;

// `default=false` : sans ce paramètre, Open Library répond 200 avec une image
// « pas de couverture » au lieu du 404 qui nous renseigne.
const urlOpenLibrary = (isbn13: string) =>
  `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false`;

/** Ramène le texte sous le plafond, sur une fin de phrase quand c'est possible. */
function borner(texte: string): string {
  if (texte.length <= SYNOPSIS_MAXIMAL) return texte;

  const tronque = texte.slice(0, SYNOPSIS_MAXIMAL);
  const fin = Math.max(
    tronque.lastIndexOf(". "),
    tronque.lastIndexOf(".\n"),
    tronque.lastIndexOf("… "),
  );
  return fin > SYNOPSIS_MAXIMAL / 2
    ? tronque.slice(0, fin + 1)
    : `${tronque.trimEnd()}…`;
}

type Resultat = { titre: string; auteur: string; vignette: string; description: string };

/**
 * Le résultat désigne-t-il bien notre livre ?
 *
 * Une recherche par titre rend forcément des approximations, et une
 * couverture fausse est bien pire qu'une couverture absente : elle se donne
 * pour vraie, et rien à l'écran ne la dénonce. Un synopsis emprunté au tome
 * suivant serait pire encore — il raconterait la suite. On exige donc que le
 * titre passe la règle d'appariement — celle-là même qui empêche « La femme
 * de ménage » d'avaler « La Femme de ménage voit tout » — *et* qu'un mot du
 * nom d'auteur se retrouve de part et d'autre.
 *
 * En cas de doute, on ne prend rien : le repli graphique est prévu pour ça,
 * et un champ vide s'écrit à la main.
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
): Promise<{ vignette: string | null; synopsis: string | null } | null> {
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
      description?: string;
    }>;
  };

  for (const brut of données.results ?? []) {
    if (!brut.trackName || !brut.artistName) continue;
    const candidat: Resultat = {
      titre: brut.trackName,
      auteur: brut.artistName,
      vignette: brut.artworkUrl100 ?? "",
      description: brut.description ?? "",
    };
    if (!correspond(candidat, titre, auteur)) continue;

    const propre = candidat.description
      ? texteDepuisHtml(candidat.description)
      : "";

    return {
      // La vignette est servie en 100 px, illisible sur une étagère. Le
      // gabarit se réécrit dans l'adresse ; Apple rend alors la même image en
      // grand.
      vignette: candidat.vignette
        ? candidat.vignette.replace(/\/100x100bb\.jpg$/, "/600x600bb.jpg")
        : null,
      synopsis: propre.length >= SYNOPSIS_MINIMAL ? borner(propre) : null,
    };
  }

  return null;
}

/**
 * Ce que les catalogues savent apporter à ce livre.
 *
 * Apple passe en premier quand le livre a besoin d'un texte : c'est la seule
 * source qui en fournit, et la même requête rend aussi la couverture. Google
 * et Open Library ne sont sollicités que si l'image manque encore.
 */
async function enrichirUn(livre: LivreAEnrichir): Promise<Apport | null> {
  const apport: Apport = { cle: livre.cle };

  if (livre.besoinSynopsis || livre.besoinCouverture) {
    try {
      const apple = await chercherApple(livre.titre, livre.auteur);
      if (apple) {
        if (livre.besoinSynopsis && apple.synopsis) {
          apport.synopsis = apple.synopsis;
        }
        if (livre.besoinCouverture && apple.vignette) {
          const image = await imagePlausible(apple.vignette);
          if (image) apport.couverture = image;
        }
      }
    } catch {
      // Source injoignable : les suivantes ont peut-être l'image.
    }
  }

  if (livre.besoinCouverture && !apport.couverture && livre.isbn13) {
    for (const [url, delai] of [
      [urlGoogle(livre.isbn13), undefined],
      [urlOpenLibrary(livre.isbn13), DELAI_DERNIER_RECOURS],
    ] as const) {
      try {
        const image = await imagePlausible(url, delai);
        if (image) {
          apport.couverture = image;
          break;
        }
      } catch {
        // Une couverture absente n'est pas un échec, le repli est prévu.
      }
    }
  }

  return apport.couverture || apport.synopsis ? apport : null;
}

/**
 * Complète un lot de fiches, en écartant les images partagées.
 *
 * C'est la répétition qui trahit le substitut : deux livres différents ne
 * peuvent pas avoir la même image au bit près. La détection s'ajuste donc
 * d'elle-même, sans dépendre d'une liste d'empreintes à maintenir. Seule
 * l'image est retirée : le synopsis rapporté par la même requête reste bon,
 * et le perdre obligerait à tout redemander.
 */
export async function enrichirFiches(
  livres: LivreAEnrichir[],
  options: {
    /** Plafond de débit : Open Library coupe au-delà de 10 requêtes/seconde */
    pauseMs?: number;
    /**
     * Budget de temps, en millisecondes.
     *
     * C'est lui qui borne la vague, pas le nombre de livres : un catalogue
     * lent transforme vingt-cinq recherches en plusieurs minutes, et la
     * fonction serveur est coupée bien avant — la vague entière est alors
     * perdue, y compris ce qui avait déjà été trouvé. On rend donc la main de
     * nous-mêmes, en disant jusqu'où on est allé.
     */
    budgetMs?: number;
  } = {},
): Promise<{ apports: Apport[]; substituts: number; examines: number }> {
  const { pauseMs = 120, budgetMs = 20_000 } = options;
  const brut: Apport[] = [];
  const debut = Date.now();
  let examines = 0;

  for (const livre of livres) {
    const a = await enrichirUn(livre);
    examines += 1;
    if (a) brut.push(a);
    // Au moins un livre est toujours traité, sinon une vague trop lente
    // n'avancerait jamais et la boucle appelante tournerait à vide.
    if (Date.now() - debut > budgetMs) break;
    await new Promise((r) => setTimeout(r, pauseMs));
  }

  const compte = new Map<string, number>();
  for (const a of brut) {
    if (!a.couverture) continue;
    const e = a.couverture.empreinte;
    compte.set(e, (compte.get(e) ?? 0) + 1);
  }

  let substituts = 0;
  const apports = brut
    .map((a) => {
      if (a.couverture && compte.get(a.couverture.empreinte) !== 1) {
        substituts += 1;
        return { ...a, couverture: undefined };
      }
      return a;
    })
    .filter((a) => a.couverture || a.synopsis);

  return { apports, substituts, examines };
}
