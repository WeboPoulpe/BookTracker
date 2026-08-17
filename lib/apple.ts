import { deduireGenre } from "./catalogues";
import { extraireSerie } from "./openlibrary";
import type { Resultat } from "./openlibrary";

/**
 * Apple Books — recherche de métadonnées.
 *
 * Les deux autres catalogues laissaient l'écran d'ajout presque vide. Open
 * Library ne répond pas, et la BnF — seule à tenir — ne donne ni genre, ni
 * pagination, ni couverture : ses notices renvoyaient vers le service
 * d'images d'Open Library, injoignable lui aussi. Sa pertinence achevait le
 * tableau, « Jamais plus » remontant « Le vray et le faux protestant » en
 * tête.
 *
 * Apple apporte ce qui manquait : la couverture, le rayon dont on déduit le
 * genre, et un classement qui reconnaît un titre français. C'est déjà la
 * source qui complète les fiches après coup (lib/catalogues.ts) ; l'employer
 * aussi à l'ajout évite de créer une fiche vide pour la remplir ensuite.
 *
 * Elle ne donne en revanche **aucune pagination**, et son ISBN est celui de
 * l'édition numérique — donc jamais celui du poche qu'on tient. On n'en
 * remonte pas, et la fusion laisse la BnF fournir l'ISBN quand elle l'a.
 */

const RACINE = "https://itunes.apple.com/search";

/**
 * « Colleen Hoover & Pauline Vidal » → « Colleen Hoover ».
 *
 * Apple concatène auteur et traducteur — onze fois sur quarante-huit dans un
 * relevé sur cette bibliothèque. Dix fois sur onze l'auteur vient en tête, et
 * garder la chaîne entière polluerait le classement par auteur des
 * statistiques. On prend donc le premier nom.
 *
 * L'exception connue est « Nathalie Peronny & Jay Asher », où la traductrice
 * précède. Le champ reste modifiable dans le formulaire d'ajout, qui est
 * précisément fait pour ça.
 */
function auteurPrincipal(brut: string | undefined): string {
  const premier = (brut ?? "").split(/[,&]/)[0]?.trim();
  return premier || "Auteur inconnu";
}

/** Le gabarit de la vignette se réécrit dans l'adresse : 100 px → 600 px. */
function couverture(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/100x100bb\.jpg$/, "/600x600bb.jpg");
}

type ReponseApple = {
  results?: Array<{
    trackId?: number;
    trackName?: string;
    artistName?: string;
    artworkUrl100?: string;
    releaseDate?: string;
    genres?: string[];
  }>;
};

export async function rechercherApple(
  requete: string,
  limite = 12,
): Promise<Resultat[]> {
  const q = requete.trim();
  if (q.length < 2) return [];

  const url = new URL(RACINE);
  url.searchParams.set("country", "FR");
  url.searchParams.set("entity", "ebook");
  url.searchParams.set("limit", String(limite));
  url.searchParams.set("term", q);

  // Pas de `signal` : combiné au cache de données de Next, il fait rester la
  // requête en suspens. Le plafond est appliqué par `avecDelai`, comme pour
  // les deux autres sources.
  const r = await fetch(url, { next: { revalidate: 86_400 } });
  if (!r.ok) throw new Error(`Apple Books a répondu ${r.status}`);

  const données = (await r.json()) as ReponseApple;
  const resultats: Resultat[] = [];

  for (const brut of données.results ?? []) {
    if (!brut.trackName) continue;

    const rayons = deduireGenre(brut.genres ?? []);
    // La série vit dans le titre ici aussi : « Les Légendes - tome 1 - Black
    // Venus ». L'extraction est la même que pour les autres catalogues.
    const { titre, serie, tome } = extraireSerie(brut.trackName);

    resultats.push({
      cle: `apple:${brut.trackId ?? brut.trackName}`,
      titre,
      auteur: auteurPrincipal(brut.artistName),
      annee: brut.releaseDate
        ? Number.parseInt(brut.releaseDate.slice(0, 4), 10)
        : null,
      // Son ISBN est celui de l'édition numérique : le remonter ferait
      // enregistrer un identifiant qui ne désigne pas le livre possédé, et
      // fausserait le dédoublonnage à l'import.
      isbn13: null,
      pages: null,
      couvertureUrl: couverture(brut.artworkUrl100),
      genre: rayons?.genre ?? null,
      serie,
      tome,
      source: "apple",
      // La boutique interrogée est la française, sans que la fiche dise pour
      // autant la langue de l'ouvrage. On ne l'invente pas.
      langue: null,
    });
  }

  return resultats;
}
