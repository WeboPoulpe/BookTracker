import { rechercherApple } from "./apple";
import { rechercherBnf } from "./bnf";
import { normaliser } from "./texte";
import {
  OPEN_LIBRARY_JOIGNABLE,
  rechercher as rechercherOL,
  type Resultat,
  type Source,
} from "./openlibrary";

/**
 * Recherche de livre sur des catalogues complémentaires.
 *
 * Aucun ne suffit seul :
 *   · la BnF a tout le dépôt légal français et les ISBN du papier, mais ses
 *     notices Dublin Core n'ont ni pagination, ni couverture, ni genre, et
 *     son `bib.anywhere` remonte « Le vray et le faux protestant » pour
 *     « Jamais plus » ;
 *   · Apple Books a la couverture, le rayon et un classement qui reconnaît un
 *     titre français, mais ni pagination ni ISBN du papier ;
 *   · Open Library avait les trois, dont la pagination que personne d'autre
 *     ne donne — elle est hors service, et n'est plus interrogée (voir
 *     `OPEN_LIBRARY_JOIGNABLE`).
 *
 * On les interroge en parallèle et on fusionne. Si l'une tombe, les autres
 * répondent quand même : c'est précisément ce qui manquait quand « Open
 * Library ne répond pas » vidait tout l'écran.
 *
 * `allSettled` attend néanmoins la plus lente : une source qu'on sait morte
 * n'est pas seulement inutile, elle retient les autres. Écarter Open Library
 * a ramené la recherche de 4 146 ms à 655 ms.
 */

export type EtatSource = "ok" | "vide" | "echec";

export type ReponseRecherche = {
  resultats: Resultat[];
  sources: Record<Source, EtatSource>;
  /** Vrai si aucune source n'a pu être jointe — à distinguer de « 0 résultat » */
  toutesEnEchec: boolean;
};

/**
 * Plafond par catalogue.
 *
 * La BnF répond en ~500 ms, Open Library en ~2,5 s quand il va bien. À 4 s
 * on laisse leur chance aux deux sans imposer une attente absurde devant une
 * source injoignable — l'autre a déjà répondu depuis longtemps.
 */
const DELAI_MS = 4000;

/**
 * Plafonne la durée d'une tâche, sans `AbortSignal`.
 *
 * On ne peut pas passer de `signal` à un `fetch` qui utilise le cache de
 * données de Next (`next: { revalidate }`) : la requête reste alors en
 * suspens jusqu'à l'expiration du signal, et le garde-fou devient la panne
 * qu'il devait prévenir. Une course contre un minuteur donne le même
 * plafond tout en gardant le cache — la requête perdante continue en
 * arrière-plan et alimentera le cache pour la frappe suivante.
 */
function avecDelai<T>(tache: Promise<T>, ms: number): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout>;
  const limite = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(
      () => rejeter(new Error(`Délai de ${ms} ms dépassé`)),
      ms,
    );
  });
  return Promise.race([tache, limite]).finally(() => clearTimeout(minuteur));
}

/**
 * Un réessai unique, après une courte pause.
 *
 * Les échecs observés sur Open Library sont des `TypeError: fetch failed` —
 * connexion coupée, pas réponse d'erreur. Ce type de panne se répare tout
 * seul en quelques centaines de millisecondes. Au-delà d'un essai
 * supplémentaire on ferait attendre pour rien : l'autre catalogue répond
 * déjà, et la saisie manuelle est à un doigt.
 */
async function avecReessai<T>(tache: () => Promise<T>): Promise<T> {
  const debut = Date.now();
  try {
    return await avecDelai(tache(), DELAI_MS);
  } catch (e) {
    // Ce qui reste du budget après le premier essai. Inutile de rejouer si
    // l'utilisateur a déjà attendu la quasi-totalité du délai.
    const restant = DELAI_MS - (Date.now() - debut) - 250;
    if (restant < 800) throw e;
    await new Promise((r) => setTimeout(r, 250));
    return avecDelai(tache(), restant);
  }
}

/* La normalisation vient de lib/texte : celle qui vivait ici ignorait les
   ligatures, si bien que « Les Sept Sœurs » et « Les Sept Soeurs » formaient
   deux clés distinctes et échappaient au dédoublonnage entre catalogues.
   C'est le piège que lib/texte documente et corrige en un seul endroit. */

/**
 * Fusionne les doublons entre catalogues.
 *
 * Deux notices du même livre se complètent : la BnF donne le titre français
 * exact, Open Library la pagination et la couverture. On garde la plus
 * riche des deux plutôt que d'afficher la même chose deux fois.
 */
/** Résultat annoté de son rang dans sa source d'origine. */
type Classe = Resultat & { rang: number };

function fusionner(resultats: Classe[]): Classe[] {
  const parCle = new Map<string, Classe>();

  for (const r of resultats) {
    // L'ISBN est l'identité forte ; à défaut, titre + auteur normalisés.
    const cle = r.isbn13 ?? `${normaliser(r.titre)}|${normaliser(r.auteur)}`;
    const existant = parCle.get(cle);

    if (!existant) {
      parCle.set(cle, r);
      continue;
    }

    parCle.set(cle, {
      ...existant,
      // Chaque champ vient de la source qui le connaît.
      pages: existant.pages ?? r.pages,
      isbn13: existant.isbn13 ?? r.isbn13,
      couvertureUrl: existant.couvertureUrl ?? r.couvertureUrl,
      genre: existant.genre ?? r.genre,
      serie: existant.serie ?? r.serie,
      tome: existant.tome ?? r.tome,
      annee: existant.annee ?? r.annee,
      // Le français l'emporte : si l'un des deux catalogues signale une
      // édition française, c'est l'information utile ici.
      langue:
        existant.langue === "fre" || r.langue === "fre"
          ? "fre"
          : (existant.langue ?? r.langue),
      // Un livre bien classé dans l'un des deux catalogues l'est vraiment.
      rang: Math.min(existant.rang, r.rang),
    });
  }

  return [...parCle.values()];
}

/**
 * Mots de la requête qui pèsent, articles et liaisons écartés.
 *
 * « les sept sœurs » se cherche sur « sept » et « soeurs » : garder « les »
 * ferait passer pour pertinent tout titre commençant par un article, c'est-à-
 * dire à peu près tous.
 */
function motsUtiles(q: string): string[] {
  return normaliser(q)
    .split(" ")
    .filter((m) => m.length >= 3 && !MOTS_VIDES.has(m));
}

const MOTS_VIDES = new Set([
  "les", "des", "une", "aux", "que", "qui", "dans", "pour", "avec", "sur",
  "the", "and", "for", "you",
]);

/**
 * Part des mots de la requête retrouvés dans le titre et l'auteur.
 *
 * Zéro veut dire qu'aucun mot cherché n'y figure — le catalogue a répondu
 * sur autre chose : un sujet, un éditeur, une note de bas de notice.
 */
function pertinence(r: Classe, mots: string[]): number {
  if (mots.length === 0) return 1;
  const foin = ` ${normaliser(`${r.titre} ${r.auteur}`)} `;
  const trouves = mots.filter((m) => foin.includes(m)).length;
  return trouves / mots.length;
}

/**
 * Trie en plaçant d'abord ce qui répond vraiment à la requête.
 *
 * La BnF interroge en `bib.anywhere all`, qui cherche les mots partout dans
 * la notice — sujet, éditeur, note. Elle rendait donc « Le vray et le faux
 * protestant » pour « Jamais plus », et « La pocharde » pour « les sept
 * sœurs », en première position de *sa* liste. Comme chaque résultat gardait
 * le rang de sa source, ce premier déchet faisait jeu égal avec la première
 * pépite d'Apple.
 *
 * On corrige donc par la correspondance au titre demandé, et non par la
 * richesse des métadonnées : trier sur la couverture et la pagination avait
 * déjà été tenté, et remontait des livres sans rapport au motif qu'ils
 * étaient bien renseignés. Un titre qui ne contient aucun mot cherché recule,
 * qu'il vienne d'un catalogue ou d'un autre.
 */
function classer(
  resultats: Classe[],
  estFrancais: boolean,
  requete: string,
): Classe[] {
  const mots = motsUtiles(requete);

  return [...resultats].sort((a, b) => {
    const score = (r: Classe) => {
      // Le rang d'origine reste la base : les catalogues savent mieux que
      // nous départager deux notices qui répondent toutes deux à la requête.
      let s = r.rang;

      // Le recul est proportionnel aux mots manquants, et assez ample pour
      // sortir un hors-sujet de la première page sans l'effacer : un titre
      // français peut légitimement ne reprendre qu'une partie de la requête.
      s += (1 - pertinence(r, mots)) * 12;

      if (estFrancais) {
        // Une édition en langue étrangère recule, sans jamais passer
        // derrière tout le reste : sur une saga traduite, l'original
        // anglais garde sa place si le moteur l'a jugé très pertinent.
        if (r.langue && r.langue !== "fre") s += 6;
        else if (r.langue === "fre") s -= 1;
      }

      // Un simple départage : une notice exploitable en l'état évite un
      // aller-retour de saisie, mais ne vaut pas de doubler un meilleur
      // résultat.
      if (r.pages) s -= 1;
      if (r.couvertureUrl) s -= 0.5;

      return s;
    };
    return score(a) - score(b);
  });
}

/** Heuristique légère : accents ou mots-outils français dans la requête. */
function requeteFrancaise(q: string): boolean {
  return (
    /[àâäéèêëïîôöùûüçœ]/i.test(q) ||
    /\b(le|la|les|des|du|un|une|et|dans|sur|sept|soeurs|sœurs)\b/i.test(q)
  );
}

export async function rechercherLivre(
  requete: string,
): Promise<ReponseRecherche> {
  const q = requete.trim();
  if (q.length < 2) {
    return {
      resultats: [],
      sources: { openlibrary: "vide", bnf: "vide", apple: "vide" },
      toutesEnEchec: false,
    };
  }

  // `allSettled` et non `all` : la panne d'un catalogue ne doit pas
  // emporter les résultats des autres. Mais elle les fait attendre — d'où
  // l'exclusion d'une source dont on sait déjà qu'elle ne répondra pas.
  const [bnf, apple, ol] = await Promise.allSettled([
    avecReessai(() => rechercherBnf(q, 16)),
    avecReessai(() => rechercherApple(q, 16)),
    OPEN_LIBRARY_JOIGNABLE
      ? avecReessai(() => rechercherOL(q, 16))
      : Promise.resolve([] as Resultat[]),
  ]);

  const etat = (r: PromiseSettledResult<Resultat[]>): EtatSource =>
    r.status === "rejected" ? "echec" : r.value.length ? "ok" : "vide";

  const sources: Record<Source, EtatSource> = {
    // « vide » et non « echec » tant qu'elle n'est pas interrogée : annoncer
    // une panne à chaque recherche ne dirait rien qu'on ne sache déjà, et
    // ferait croire la liste amputée d'un catalogue qui répondrait demain.
    openlibrary: etat(ol),
    bnf: etat(bnf),
    apple: etat(apple),
  };

  if (ol.status === "rejected") {
    console.error("Recherche Open Library en échec :", ol.reason);
  }
  if (bnf.status === "rejected") {
    console.error("Recherche BnF en échec :", bnf.reason);
  }
  if (apple.status === "rejected") {
    console.error("Recherche Apple Books en échec :", apple.reason);
  }

  // Chaque résultat garde la place que sa source lui a donnée.
  const brut: Classe[] = [bnf, apple, ol].flatMap((s) =>
    (s.status === "fulfilled" ? s.value : []).map((r, rang) => ({ ...r, rang })),
  );

  const resultats = classer(fusionner(brut), requeteFrancaise(q), q)
    // `rang` est un détail de classement : il n'a rien à faire dans la
    // réponse envoyée au client.
    .map((classe): Resultat => {
      const { rang, ...r } = classe;
      void rang;
      // Une notice BnF empruntait ici la couverture d'Open Library, déduite
      // de son ISBN. L'adresse était fabriquée sans jamais vérifier qu'une
      // image s'y trouve : c'était le seul chemin par lequel une couverture
      // entrait en base sans avoir été téléchargée. Open Library étant
      // injoignable, ces fiches paraissaient illustrées, ne montraient rien,
      // et comptaient pour complètes — donc n'étaient jamais réparées.
      //
      // Mieux vaut ne rien proposer : la vague de complètement, elle,
      // télécharge avant d'enregistrer.
      return { ...r };
    })
    .slice(0, 24);

  return {
    resultats,
    sources,
    toutesEnEchec: Object.values(sources).every((e) => e === "echec"),
  };
}
