import type { Resultat } from "./openlibrary";
import { extraireSerie } from "./openlibrary";

/**
 * Catalogue général de la BnF, via son API SRU.
 *
 * Open Library est très pauvre en francophone (§11) : « Les Sept Sœurs » de
 * Lucinda Riley n'y est pas, alors que la BnF en a plusieurs éditions. Comme
 * l'app est française et la bibliothèque aussi, la BnF est la source
 * naturelle — et elle ne demande ni clé ni inscription.
 *
 * Contrepartie : les notices sont irrégulières. Beaucoup n'ont ni ISBN ni
 * pagination, y compris en UNIMARC. On se contente donc du Dublin Core, bien
 * plus simple à lire, et on laisse la saisie manuelle compléter — ce que le
 * §11 impose de toute façon.
 */

const RACINE = "https://catalogue.bnf.fr/api/SRU";

/** Extrait le contenu de toutes les occurrences d'une balise Dublin Core. */
function champs(bloc: string, nom: string): string[] {
  // Le SRU de la BnF produit un XML plat et régulier : un `dc:title` ne
  // contient jamais un autre `dc:title`. Une expression régulière suffit
  // donc ici, là où elle serait imprudente sur du XML quelconque.
  const re = new RegExp(`<dc:${nom}[^>]*>([\\s\\S]*?)</dc:${nom}>`, "g");
  const sorties: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(bloc)) !== null) {
    sorties.push(decoder(m[1].trim()));
  }
  return sorties;
}

function decoder(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * « Riley, Lucinda (1965-2021). Auteur du texte » → « Lucinda Riley ».
 *
 * Certaines notices redoublent le nom de famille (« RileyRiley, Lucinda ») ;
 * on rattrape ce cas plutôt que d'afficher une coquille du catalogue.
 */
export function nettoyerAuteur(brut: string | undefined): string {
  if (!brut) return "Auteur inconnu";

  let v = brut
    // Mentions de rôle, où qu'elles se trouvent — la BnF les place tantôt
    // en fin de chaîne, tantôt entre parenthèses au milieu.
    .replace(
      /\(?\b(Auteur du texte|Auteur|Traducteur|Traductrice|Éditeur scientifique|Éditeur|Illustrateur|Illustratrice|Préfacier|Narrateur)\b[^),.]*\)?/gi,
      "",
    )
    // Dates de vie : (1965-2021), (1965-....), (1802-1870)
    .replace(/\(\s*\d{4}\s*-\s*[\d.]*\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[.,;]\s*$/, "");

  const virgule = v.indexOf(",");
  if (virgule > 0) {
    const nom = v.slice(0, virgule).trim();
    const prenom = v.slice(virgule + 1).trim();

    // « RileyRiley » : le nom collé deux fois d'affilée
    const moitie = nom.slice(0, Math.floor(nom.length / 2));
    const nomPropre =
      nom.length % 2 === 0 && moitie && nom === moitie + moitie ? moitie : nom;

    v = prenom ? `${prenom} ${nomPropre}` : nomPropre;
  }

  return v.trim() || "Auteur inconnu";
}

/** « Les sept soeurs / Lucinda Riley ; traduit par… » → titre seul. */
function nettoyerTitre(brut: string): { titre: string; auteur: string | null } {
  const [avant, ...apres] = brut.split(" / ");
  const titre = avant.replace(/\s*:\s*$/, "").trim();
  const mention = apres.join(" / ").split(";")[0]?.trim() ?? null;
  return { titre, auteur: mention || null };
}

function annee(brut: string | undefined): number | null {
  if (!brut) return null;
  const m = brut.match(/(\d{4})/);
  return m ? Number.parseInt(m[1], 10) : null;
}

/** L'ISBN n'est présent que dans une minorité de notices Dublin Core. */
function isbnDepuis(identifiants: string[]): string | null {
  for (const i of identifiants) {
    const propre = i.replace(/[^0-9Xx]/g, "");
    if (propre.length === 13 && propre.startsWith("97")) return propre;
  }
  return null;
}

export async function rechercherBnf(
  requete: string,
  limite = 12,
): Promise<Resultat[]> {
  const q = requete.trim();
  if (q.length < 2) return [];

  const chiffres = q.replace(/[^0-9Xx]/g, "");
  const estIsbn =
    (chiffres.length === 13 || chiffres.length === 10) && /^\d/.test(chiffres);

  // `all` exige tous les mots, ce qui est le bon compromis : `any` renvoie
  // 300 notices dès qu'on tape « sept soeurs », dont des sermons du XIXᵉ.
  const clause = estIsbn
    ? `bib.isbn any "${chiffres}"`
    : `bib.anywhere all "${q.replace(/"/g, "")}"`;

  const url = new URL(RACINE);
  url.searchParams.set("version", "1.2");
  url.searchParams.set("operation", "searchRetrieve");
  url.searchParams.set("query", clause);
  url.searchParams.set("recordSchema", "dublincore");
  url.searchParams.set("maximumRecords", String(limite));

  // Pas de `signal` : combiné au cache de données de Next, il fait rester la
  // requête en suspens. Le plafond est appliqué par `avecDelai`.
  const r = await fetch(url, {
    headers: { Accept: "application/xml" },
    next: { revalidate: 86_400 },
  });

  if (!r.ok) throw new Error(`BnF a répondu ${r.status}`);

  const xml = await r.text();
  const blocs = xml.split("<srw:record>").slice(1);

  const resultats: Resultat[] = [];

  for (const bloc of blocs) {
    const titres = champs(bloc, "title");
    if (titres.length === 0) continue;

    const { titre: titreBrut, auteur: auteurMention } = nettoyerTitre(titres[0]);
    const { titre, serie, tome } = extraireSerie(titreBrut);

    const createurs = champs(bloc, "creator");
    const auteur = createurs.length
      ? nettoyerAuteur(createurs[0])
      : (auteurMention ?? "Auteur inconnu");

    const isbn13 = isbnDepuis(champs(bloc, "identifier"));

    // On ignore volontairement `dc:description`, qui porte la collection
    // éditoriale (« Le livre de poche ») et non la saga. La confondre avec
    // une série remplirait l'écran Séries de faux positifs.
    resultats.push({
      cle: `bnf:${champs(bloc, "identifier")[0] ?? `${titre}-${auteur}`}`,
      titre,
      auteur,
      annee: annee(champs(bloc, "date")[0]),
      isbn13,
      pages: null,
      couvertureUrl: null,
      genre: null,
      serie,
      tome,
      source: "bnf",
      langue: champs(bloc, "language")[0] ?? "fre",
    });
  }

  return resultats;
}
