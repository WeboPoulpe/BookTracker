import { resoudreGenre } from "./genres";

/**
 * Open Library — recherche de métadonnées.
 *
 * Le catalogue francophone y est incomplet (§11) : ce module ne doit jamais
 * être un passage obligé. Tout ce qu'il renvoie est pré-rempli dans un
 * formulaire que l'utilisateur peut corriger, et l'ajout manuel reste ouvert.
 */

/**
 * Open Library est-elle interrogée ?
 *
 * Non, depuis le 17 août 2026 : le service est hors ligne. Constaté sur deux
 * réseaux indépendants — délai dépassé systématique depuis un poste, et
 * `ECONNREFUSED` sur 207.241.234.205 depuis une autre infrastructure. La
 * connexion est activement refusée, ce n'est donc pas un pare-feu local.
 *
 * Le coût n'était pas qu'un manque : `Promise.allSettled` attendant toutes
 * les sources, chaque recherche de livre patientait quatre secondes pour rien
 * — 4 146 ms au lieu de 149 ms sur « Jamais plus ». À l'enrichissement, elle
 * ajoutait deux secondes par livre que les autres sources n'avaient pas su
 * traiter.
 *
 * Le code de la source reste entier : c'est la seule à connaître la
 * pagination, et son catalogue vaut qu'on y revienne. Repasser cette
 * constante à `true` la réinterroge, sans autre changement.
 */
export const OPEN_LIBRARY_JOIGNABLE = false;

export type Source = "openlibrary" | "bnf" | "apple";

export type Resultat = {
  cle: string;
  titre: string;
  auteur: string;
  annee: number | null;
  isbn13: string | null;
  pages: number | null;
  couvertureUrl: string | null;
  genre: string | null;
  /** Série et tome extraits du titre quand le catalogue les y a laissés */
  serie: string | null;
  tome: number | null;
  source: Source;
  /** Code MARC à trois lettres : « fre », « eng »… null si inconnu */
  langue: string | null;
};

type ReponseOL = {
  numFound?: number;
  docs?: Array<{
    key?: string;
    title?: string;
    author_name?: string[];
    first_publish_year?: number;
    isbn?: string[];
    cover_i?: number;
    number_of_pages_median?: number;
    subject?: string[];
    language?: string[];
  }>;
};

/**
 * « Le Palais des vents (Les Sept Sœurs, #4) » → série + tome.
 * Goodreads comme Open Library utilisent cette convention entre parenthèses.
 */
export function extraireSerie(titre: string): {
  titre: string;
  serie: string | null;
  tome: number | null;
} {
  const m = titre.match(/^(.*?)\s*\(([^()]*?),?\s*#(\d+(?:\.\d+)?)\s*\)\s*$/);
  if (!m) return { titre: titre.trim(), serie: null, tome: null };

  const [, base, serie, tome] = m;
  return {
    titre: base.trim(),
    serie: serie.trim() || null,
    tome: Number.parseFloat(tome),
  };
}

function meilleurIsbn(isbns?: string[]): string | null {
  if (!isbns?.length) return null;
  // On privilégie l'ISBN-13 : c'est la clé des couvertures et du CSV Goodreads
  return isbns.find((i) => i.replace(/\D/g, "").length === 13) ?? isbns[0] ?? null;
}

function genreDepuisSujets(sujets?: string[]): string | null {
  if (!sujets?.length) return null;
  // Open Library empile des dizaines de sujets ; on garde le premier qui
  // tombe dans notre référentiel plutôt que le premier tout court.
  for (const s of sujets.slice(0, 25)) {
    const g = resoudreGenre(s);
    if (g.cle !== "inconnu") return g.libelle;
  }
  return null;
}

export async function rechercher(
  requete: string,
  limite = 20,
): Promise<Resultat[]> {
  const q = requete.trim();
  if (q.length < 2) return [];

  const url = new URL("https://openlibrary.org/search.json");
  // Recherche par ISBN si l'utilisateur en colle un
  const chiffres = q.replace(/[^0-9Xx]/g, "");
  if ((chiffres.length === 13 || chiffres.length === 10) && /^\d/.test(chiffres)) {
    url.searchParams.set("isbn", chiffres);
  } else {
    url.searchParams.set("q", q);
  }
  url.searchParams.set("limit", String(limite));
  url.searchParams.set(
    "fields",
    "key,title,author_name,first_publish_year,isbn,cover_i,number_of_pages_median,subject,language",
  );

  const r = await fetch(url, {
    // Pas de `signal` ici : combiné au cache de données de Next, il fait
    // rester la requête en suspens. Le plafond de durée est appliqué par
    // `avecDelai` dans lib/recherche.ts.
    //
    // Open Library demande un User-Agent identifiable avec un moyen de
    // contact, et limite plus sévèrement ceux qui n'en ont pas.
    headers: {
      "User-Agent":
        "MaBibliotheque/0.1 (suivi de lecture personnel; maxence@webomax.fr)",
    },
    // Cache 24 h : les métadonnées d'un livre paru ne bougent pas
    next: { revalidate: 86_400 },
  });

  if (!r.ok) throw new Error(`Open Library a répondu ${r.status}`);

  const data = (await r.json()) as ReponseOL;

  return (data.docs ?? []).map((d) => {
    const brut = d.title ?? "Sans titre";
    const { titre, serie, tome } = extraireSerie(brut);
    const isbn13 = meilleurIsbn(d.isbn);

    return {
      cle: d.key ?? `${titre}-${d.first_publish_year ?? ""}`,
      titre,
      auteur: d.author_name?.[0] ?? "Auteur inconnu",
      annee: d.first_publish_year ?? null,
      isbn13,
      pages: d.number_of_pages_median ?? null,
      // `cover_i` seulement : c'est l'identifiant d'une image dont le
      // catalogue atteste l'existence. Déduire une adresse de l'ISBN quand il
      // manque produisait un lien plausible vers rien — la fiche paraissait
      // illustrée, n'affichait aucune image, et comptait pour complète.
      couvertureUrl: d.cover_i
        ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`
        : null,
      genre: genreDepuisSujets(d.subject),
      serie,
      tome,
      source: "openlibrary",
      // Une notice réunit souvent plusieurs éditions : si le français figure
      // parmi les langues, l'ouvrage existe en français, c'est ce qui compte
      // pour le classement.
      langue: d.language?.includes("fre") ? "fre" : (d.language?.[0] ?? null),
    };
  });
}
