import { rechercherApple } from "./apple";
import { rechercherBnf } from "./bnf";
import { couvertureParIsbn, rechercher as rechercherOL, type Resultat, type Source } from "./openlibrary";

/**
 * Recherche de livre sur trois catalogues complémentaires.
 *
 * Aucun ne suffit seul :
 *   · Open Library a les pages, les couvertures et les genres, mais son
 *     catalogue francophone est troué (§11) — et elle ne répond plus ;
 *   · la BnF a tout le dépôt légal français et les ISBN du papier, mais ses
 *     notices Dublin Core n'ont ni pagination, ni couverture, ni genre ;
 *   · Apple Books a la couverture, le rayon et un classement qui reconnaît un
 *     titre français, mais ni pagination ni ISBN du papier.
 *
 * Apple a été ajoutée quand l'écran d'ajout s'est retrouvé quasi vide : Open
 * Library en échec, il ne restait que la BnF, qui remontait « Le vray et le
 * faux protestant » pour « Jamais plus » — sans image ni genre.
 *
 * On interroge les trois en parallèle et on fusionne. Si l'une tombe, les
 * autres répondent quand même : c'est précisément ce qui manquait quand
 * « Open Library ne répond pas » vidait tout l'écran.
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

function normaliser(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]/g, "");
}

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
 * Trie en plaçant d'abord ce qui est directement exploitable.
 *
 * Une notice avec couverture et pagination épargne un aller-retour de
 * saisie ; c'est ce qui doit remonter en tête, pas la plus « pertinente »
 * au sens du moteur.
 */
function classer(resultats: Classe[], estFrancais: boolean): Classe[] {
  return [...resultats].sort((a, b) => {
    // Le rang d'origine domine : les deux catalogues savent bien mieux que
    // nous si « Les sept petits musiciens » répond à « les sept sœurs ».
    // Trier sur la seule richesse des métadonnées remontait des livres sans
    // rapport, au motif qu'ils avaient une couverture et une pagination.
    const score = (r: Classe) => {
      let s = r.rang;

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
  // emporter les résultats de l'autre.
  const [ol, bnf, apple] = await Promise.allSettled([
    avecReessai(() => rechercherOL(q, 16)),
    avecReessai(() => rechercherBnf(q, 16)),
    avecReessai(() => rechercherApple(q, 16)),
  ]);

  const etat = (r: PromiseSettledResult<Resultat[]>): EtatSource =>
    r.status === "rejected" ? "echec" : r.value.length ? "ok" : "vide";

  const sources: Record<Source, EtatSource> = {
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
  const brut: Classe[] = [ol, bnf, apple].flatMap((s) =>
    (s.status === "fulfilled" ? s.value : []).map((r, rang) => ({ ...r, rang })),
  );

  const resultats = classer(fusionner(brut), requeteFrancaise(q))
    // `rang` est un détail de classement : il n'a rien à faire dans la
    // réponse envoyée au client.
    .map((classe): Resultat => {
      const { rang, ...r } = classe;
      void rang;
      return {
        ...r,
        // Une notice BnF avec ISBN peut emprunter la couverture d'Open
        // Library : le service d'images est indépendant du moteur de
        // recherche, et reste debout quand celui-ci flanche.
        couvertureUrl: r.couvertureUrl ?? couvertureParIsbn(r.isbn13),
      };
    })
    .slice(0, 24);

  return {
    resultats,
    sources,
    toutesEnEchec: Object.values(sources).every((e) => e === "echec"),
  };
}
