import { and, eq, isNotNull, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { lectures, livres } from "@/db/schema";
import { enrichirFiches } from "@/lib/catalogues";
import type { LivreImporte } from "@/lib/goodreads";
import { memeTitre, normaliser } from "@/lib/texte";

import { resoudreSerie } from "./mutations";

export type ResultatLot = {
  crees: number;
  /** Livres déjà présents, enrichis de champs qui leur manquaient */
  completes: number;
  /** Livres déjà présents et déjà complets */
  inchanges: number;
  /** Lectures ajoutées à des livres existants */
  lecturesAjoutees: number;
  /** Lectures déjà connues dont une borne manquante a été comblée */
  lecturesCompletees: number;
  echecs: Array<{ titre: string; motif: string }>;
};

/**
 * Empreinte de dédoublonnage.
 *
 * L'ISBN quand il existe, sinon titre + auteur normalisés. Réimporter le même
 * export ne doit pas dupliquer la bibliothèque — c'est le geste qu'on fait
 * naturellement quand un premier import a échoué à mi-chemin, ou quand on
 * verse un second catalogue par-dessus le premier.
 */
function empreinte(titre: string, auteur: string) {
  return `${normaliser(titre)}|${normaliser(auteur)}`;
}

/**
 * Périodes de lecture d'une entrée, sans répétition.
 *
 * Un catalogue peut lister deux fois la même lecture — Bookmory répète sa
 * colonne « Période de lecture », StoryGraph empile les dates dans un seul
 * champ. Les insérer telles quelles créait deux lectures identiques, ce qui
 * comptait le livre deux fois dans l'année sans que rien ne le signale. Un
 * doublon de ce type existait en base sur « La chronique des Bridgerton
 * (Tomes 5 & 6) ».
 *
 * Le dédoublonnage porte sur le couple de dates : deux lectures du même
 * livre commencées et finies les mêmes jours sont la même lecture.
 */
function periodesDistinctes<T extends { debut: string | null; fin: string }>(
  periodes: T[] | undefined,
): T[] {
  const vues = new Set<string>();
  return (periodes ?? []).filter((p) => {
    const cle = `${p.debut ?? ""}|${p.fin}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
}

type Existant = {
  id: number;
  titre: string;
  auteur: string;
  isbn13: string | null;
  pages: number | null;
  genre: string | null;
  sousGenre: string | null;
  note: number | null;
  tome: number | null;
  serieId: number | null;
  avis: string | null;
  humeur: string | null;
  emoji: string | null;
  axeIntrigue: number | null;
  axePersonnages: number | null;
  axeThemes: number | null;
  dateSortie: string | null;
  prix: number | null;
};

/** Ne retient que ce qui manque : un champ déjà rempli n'est jamais écrasé. */
function completerChamps(
  existant: Existant,
  entree: LivreImporte,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const combler = <C extends keyof Existant>(
    champ: C,
    valeur: Existant[C] | null | undefined,
  ) => {
    if (existant[champ] === null && valeur !== null && valeur !== undefined) {
      patch[champ as string] = valeur;
    }
  };

  combler("isbn13", entree.isbn13);
  combler("pages", entree.pages);
  combler("genre", entree.genre ?? null);
  combler("sousGenre", entree.sousGenre ?? null);
  combler("note", entree.note);
  combler("tome", entree.tome);
  combler("avis", entree.avis);
  combler("humeur", entree.humeur ?? null);
  combler("emoji", entree.emoji ?? null);
  combler("axeIntrigue", entree.axeIntrigue ?? null);
  combler("axePersonnages", entree.axePersonnages ?? null);
  combler("axeThemes", entree.axeThemes ?? null);
  combler("dateSortie", entree.dateSortie ?? null);
  combler("prix", entree.prix ?? null);

  // Le statut et le format ne sont jamais « manquants » : ils ont une valeur
  // par défaut en base. Les compléter reviendrait à écraser un choix.

  return patch;
}

export async function importerLot(
  utilisateurId: string,
  lot: LivreImporte[],
): Promise<ResultatLot> {
  const resultat: ResultatLot = {
    crees: 0,
    completes: 0,
    inchanges: 0,
    lecturesAjoutees: 0,
    lecturesCompletees: 0,
    echecs: [],
  };
  if (lot.length === 0) return resultat;

  // Un seul aller-retour pour connaître l'existant : sur un import de 800
  // titres, une requête par livre coûterait plusieurs minutes.
  const existants: Existant[] = await db
    .select({
      id: livres.id,
      titre: livres.titre,
      auteur: livres.auteur,
      isbn13: livres.isbn13,
      pages: livres.pages,
      genre: livres.genre,
      sousGenre: livres.sousGenre,
      note: livres.note,
      tome: livres.tome,
      serieId: livres.serieId,
      avis: livres.avis,
      humeur: livres.humeur,
      emoji: livres.emoji,
      axeIntrigue: livres.axeIntrigue,
      axePersonnages: livres.axePersonnages,
      axeThemes: livres.axeThemes,
      dateSortie: livres.dateSortie,
      prix: livres.prix,
    })
    .from(livres)
    .where(eq(livres.utilisateurId, utilisateurId));

  const parIsbn = new Map<string, Existant>();
  const parEmpreinte = new Map<string, Existant>();
  for (const e of existants) {
    if (e.isbn13) parIsbn.set(e.isbn13, e);
    parEmpreinte.set(empreinte(e.titre, e.auteur), e);
  }

  // Lectures déjà enregistrées, indexées par leur fin, pour ne pas rejouer un
  // historique qu'un premier import a déjà posé. On garde leur identifiant et
  // leur début : une lecture déjà connue peut encore être *complétée* par un
  // second catalogue, et s'en tenir à un ensemble de fins l'interdisait.
  const lecturesConnues = new Map<
    string,
    { id: number; debut: string | null }
  >();
  if (existants.length > 0) {
    const dejaLa = await db
      .select({
        id: lectures.id,
        livreId: lectures.livreId,
        fin: lectures.fin,
        debut: lectures.debut,
      })
      .from(lectures)
      .where(
        and(
          inArray(
            lectures.livreId,
            existants.map((e) => e.id),
          ),
          isNotNull(lectures.fin),
        ),
      );
    for (const l of dejaLa) {
      lecturesConnues.set(`${l.livreId}|${l.fin}`, { id: l.id, debut: l.debut });
    }
  }

  for (const entree of lot) {
    try {
      const cle = empreinte(entree.titre, entree.auteur);

      /* Trois passes, de la plus sûre à la plus tolérante. La dernière
         rattrape les catalogues qui écrivent le sous-titre ou l'édition dans
         le titre — « La psy » contre « La Psy », « Verity » contre
         « Verity- version française ». */
      const existant =
        (entree.isbn13 ? parIsbn.get(entree.isbn13) : undefined) ??
        parEmpreinte.get(cle) ??
        existants.find(
          (e) =>
            normaliser(e.auteur) === normaliser(entree.auteur) &&
            memeTitre(e.titre, entree.titre),
        );

      if (existant) {
        const patch = completerChamps(existant, entree);

        // La série est traitée à part : elle exige une écriture préalable.
        if (existant.serieId === null && entree.serie) {
          const serieId = await resoudreSerie(
            utilisateurId,
            entree.serie,
            entree.auteur,
          );
          if (serieId) patch.serieId = serieId;
        }

        if (Object.keys(patch).length > 0) {
          await db.update(livres).set(patch).where(eq(livres.id, existant.id));
          Object.assign(existant, patch);
          resultat.completes += 1;
        } else {
          resultat.inchanges += 1;
        }

        /* Une période déjà connue par sa fin n'est pas rejouée — mais elle
           n'est plus jetée pour autant. Elle était écartée en entier, date de
           début comprise : Goodreads et StoryGraph ne donnent souvent que la
           fin, Bookmory donne les deux, et verser Bookmory par-dessus ne
           complétait donc jamais les débuts manquants. C'est le principe déjà
           tenu pour les champs du livre — ne remplir que ce qui manque, sans
           jamais écraser. */
        const nouvelles: typeof entree.periodes = [];
        for (const p of periodesDistinctes(entree.periodes)) {
          const connue = lecturesConnues.get(`${existant.id}|${p.fin}`);
          if (!connue) {
            nouvelles.push(p);
            continue;
          }
          // Un début postérieur à la fin déjà enregistrée décrit deux
          // éditions ou deux lectures distinctes, pas la même : on préfère la
          // borne manquante à une borne absurde.
          if (connue.debut === null && p.debut && (!p.fin || p.debut <= p.fin)) {
            await db
              .update(lectures)
              .set({ debut: p.debut })
              .where(eq(lectures.id, connue.id));
            connue.debut = p.debut;
            resultat.lecturesCompletees += 1;
          }
        }

        if (nouvelles.length > 0) {
          const inserees = await db
            .insert(lectures)
            .values(
              nouvelles.map((p) => ({
                livreId: existant.id,
                debut: p.debut,
                fin: p.fin,
                abandonnee: entree.statut === "abandonne",
                pageFinale:
                  entree.statut === "lu"
                    ? (existant.pages ?? entree.pages ?? null)
                    : null,
              })),
            )
            .returning({ id: lectures.id, fin: lectures.fin, debut: lectures.debut });

          for (const l of inserees) {
            lecturesConnues.set(`${existant.id}|${l.fin}`, {
              id: l.id,
              debut: l.debut,
            });
          }
          resultat.lecturesAjoutees += nouvelles.length;
        }

        continue;
      }

      /* ── Création ─────────────────────────────────────────────────── */
      const serieId = await resoudreSerie(
        utilisateurId,
        entree.serie,
        entree.auteur,
      );

      const [livre] = await db
        .insert(livres)
        .values({
          utilisateurId,
          titre: entree.titre,
          auteur: entree.auteur,
          isbn13: entree.isbn13,
          pages: entree.pages,
          note: entree.note,
          statut: entree.statut,
          serieId,
          tome: entree.tome,
          avis: entree.avis,
          format: entree.format,
          genre: entree.genre ?? null,
          sousGenre: entree.sousGenre ?? null,
          humeur: entree.humeur ?? null,
          emoji: entree.emoji ?? null,
          axeIntrigue: entree.axeIntrigue ?? null,
          axePersonnages: entree.axePersonnages ?? null,
          axeThemes: entree.axeThemes ?? null,
          dateSortie: entree.dateSortie ?? null,
          prix: entree.prix ?? null,
          // Couverture résolue après coup : la deviner depuis l'ISBN sans
          // vérifier produirait des images cassées en masse.
          couvertureUrl: null,
        })
        .returning();

      if (entree.periodes?.length) {
        // Une ligne par période : c'est ainsi qu'une relecture cesse
        // d'écraser la première.
        const inserees = await db
          .insert(lectures)
          .values(
            periodesDistinctes(entree.periodes).map((p) => ({
              livreId: livre.id,
              debut: p.debut,
              fin: p.fin,
              abandonnee: entree.statut === "abandonne",
              pageFinale: entree.statut === "lu" ? livre.pages : null,
            })),
          )
          .returning({
            id: lectures.id,
            fin: lectures.fin,
            debut: lectures.debut,
          });

        // Le même livre peut revenir plus loin dans le lot, sous un autre
        // titre : ses lectures sont déjà connues, et complétables.
        for (const l of inserees) {
          lecturesConnues.set(`${livre.id}|${l.fin}`, {
            id: l.id,
            debut: l.debut,
          });
        }
      } else if (
        // À défaut de périodes, l'historique ne se reconstruit que si le
        // catalogue a livré une date. Inventer un début de lecture
        // fausserait toutes les statistiques.
        (entree.dateAjout || entree.dateLecture) &&
        entree.statut !== "a_lire"
      ) {
        await db.insert(lectures).values({
          livreId: livre.id,
          debut: entree.dateAjout,
          fin: entree.statut === "en_cours" ? null : entree.dateLecture,
          abandonnee: entree.statut === "abandonne",
          pageFinale: entree.statut === "lu" ? livre.pages : null,
        });
      }

      const cree: Existant = {
        id: livre.id,
        titre: livre.titre,
        auteur: livre.auteur,
        isbn13: livre.isbn13,
        pages: livre.pages,
        genre: livre.genre,
        sousGenre: livre.sousGenre,
        note: livre.note,
        tome: livre.tome,
        serieId: livre.serieId,
        avis: livre.avis,
        humeur: livre.humeur,
        emoji: livre.emoji,
        axeIntrigue: livre.axeIntrigue,
        axePersonnages: livre.axePersonnages,
        axeThemes: livre.axeThemes,
        dateSortie: livre.dateSortie,
        prix: livre.prix,
      };
      // Indexé aussitôt : un même fichier peut contenir deux fois le livre.
      existants.push(cree);
      parEmpreinte.set(cle, cree);
      if (cree.isbn13) parIsbn.set(cree.isbn13, cree);

      resultat.crees += 1;
    } catch (e) {
      resultat.echecs.push({
        titre: entree.titre,
        motif: e instanceof Error ? e.message : "Erreur inconnue",
      });
    }
  }

  return resultat;
}

/**
 * Livre sans couverture affichable.
 *
 * Une adresse `covers.openlibrary.org/b/isbn/…` n'en est pas une : elle était
 * déduite d'un ISBN sans qu'aucune image ait été téléchargée. Le champ était
 * rempli, la fiche comptait pour complète, et l'écran restait gris — le
 * service ne répond plus. Les traiter comme absentes permet à la vague de les
 * remplacer par une couverture réellement obtenue.
 *
 * Les adresses `/b/id/…`, elles, désignent une image dont Open Library
 * atteste l'existence : on n'y touche pas.
 */
const SANS_COUVERTURE = sql<boolean>`(
  ${livres.couvertureUrl} is null
  or ${livres.couvertureUrl} like 'https://covers.openlibrary.org/b/isbn/%'
)`;

/**
 * Fiche à laquelle il manque quelque chose que les catalogues savent fournir.
 *
 * Une seule définition, partagée par le compte affiché, la sélection des
 * vagues et le décompte des restants : trois copies auraient fini par
 * diverger, et l'écran aurait annoncé un travail que la vague ne fait pas.
 */
const INCOMPLETE = sql`(
  ${SANS_COUVERTURE}
  or ${livres.synopsis} is null or ${livres.synopsis} = ''
  or ${livres.genre} is null or ${livres.genre} = ''
)`;

/**
 * Ce qui manque encore aux fiches, et que les catalogues savent fournir.
 *
 * Le compte des couvertures excluait les livres sans ISBN, faute de pouvoir
 * les chercher. Ils étaient alors invisibles deux fois : absents du compte,
 * et absents de la recherche — neuf livres que rien à l'écran ne signalait.
 * La recherche par titre les atteint désormais, ils rentrent donc dans le
 * compte.
 *
 * `resume` n'y figure pas et n'y figurera jamais : c'est le résumé personnel
 * de l'intrigue, ce que la quatrième de couverture est justement écrite pour
 * ne pas dire.
 */
export async function compterFichesIncompletes(utilisateurId: string): Promise<{
  sansCouverture: number;
  sansSynopsis: number;
  sansGenre: number;
  total: number;
}> {
  const [ligne] = await db
    .select({
      sansCouverture: sql<number>`count(*) filter (where ${SANS_COUVERTURE})::int`,
      sansSynopsis: sql<number>`count(*) filter (where ${livres.synopsis} is null or ${livres.synopsis} = '')::int`,
      sansGenre: sql<number>`count(*) filter (where ${livres.genre} is null or ${livres.genre} = '')::int`,
      total: sql<number>`count(*) filter (where ${INCOMPLETE})::int`,
    })
    .from(livres)
    .where(eq(livres.utilisateurId, utilisateurId));

  return {
    sansCouverture: ligne?.sansCouverture ?? 0,
    sansSynopsis: ligne?.sansSynopsis ?? 0,
    sansGenre: ligne?.sansGenre ?? 0,
    total: ligne?.total ?? 0,
  };
}

/**
 * Complète couvertures et synopsis manquants, par vagues.
 *
 * Aucun CSV n'en contient : ni Goodreads, ni StoryGraph, ni Bookmory. Les
 * deux se récupèrent donc auprès des catalogues — et d'une même requête,
 * puisque c'est la même fiche Apple qui porte l'image et la quatrième de
 * couverture. Les demander séparément doublerait les appels sans rien
 * apprendre de plus (voir lib/catalogues.ts).
 *
 * Rien n'est jamais écrasé : un synopsis déjà écrit reste tel quel, et
 * `resume` — le résumé personnel de l'intrigue — n'est pas touché du tout.
 */
export async function completerFiches(
  utilisateurId: string,
  /**
   * Curseur : ne traite que les livres d'identifiant supérieur.
   *
   * Sans lui, chaque vague repartirait du début et rejouerait les livres que
   * la précédente n'a pas su illustrer — la deuxième vague n'avancerait donc
   * jamais jusqu'au bout de la bibliothèque.
   */
  apresId = 0,
  limite = 25,
  /**
   * Budget de la vague. Tenu large sous la fenêtre d'exécution (60 s sur
   * Vercel) : dépasser, c'est perdre la vague entière, couvertures déjà
   * trouvées comprises, et n'afficher qu'un « recherche interrompue ».
   */
  budgetMs = 20_000,
  /**
   * Ne traiter que ce livre-là, curseur ignoré.
   *
   * L'ajout d'un livre s'en sert pour compléter sa fiche à la volée : sans
   * ça, il faudrait aller lancer la passe entière depuis les réglages pour
   * illustrer un seul titre qu'on vient de saisir.
   */
  livreId?: number,
): Promise<{
  traites: number;
  trouves: number;
  synopsis: number;
  genres: number;
  substituts: number;
  restants: number;
  /** Les fiches encore incomplètes, à compléter à la main */
  incompletes: Array<{
    id: number;
    titre: string;
    auteur: string;
    sansCouverture: boolean;
    sansSynopsis: boolean;
    sansGenre: boolean;
  }>;
  /** Dernier identifiant examiné, à repasser tel quel à la vague suivante */
  curseur: number;
}> {
  const candidats = await db
    .select({
      id: livres.id,
      isbn13: livres.isbn13,
      titre: livres.titre,
      auteur: livres.auteur,
      sansCouverture: SANS_COUVERTURE.as("sans_couverture"),
      synopsis: livres.synopsis,
      genre: livres.genre,
      sousGenre: livres.sousGenre,
    })
    .from(livres)
    .where(
      and(
        eq(livres.utilisateurId, utilisateurId),
        INCOMPLETE,
        // Un livre désigné court-circuite le curseur : l'ajout complète sa
        // seule fiche, sans parcourir la bibliothèque.
        livreId === undefined
          ? sql`${livres.id} > ${apresId}`
          : eq(livres.id, livreId),
      ),
    )
    .orderBy(livres.id)
    .limit(limite);

  const { apports, substituts, examines } = await enrichirFiches(
    candidats.map((c) => ({
      cle: String(c.id),
      // Un ISBN vide vaut un ISBN absent : la recherche par titre prend le
      // relais, au lieu d'interroger les catalogues avec une chaîne creuse.
      isbn13: c.isbn13 || null,
      titre: c.titre,
      auteur: c.auteur,
      besoinCouverture: c.sansCouverture,
      besoinSynopsis: !c.synopsis,
      besoinGenre: !c.genre,
    })),
    { budgetMs },
  );

  // La vague a pu s'arrêter avant la fin du lot, faute de temps : le curseur
  // doit alors s'arrêter là aussi, sinon les livres non examinés seraient
  // sautés définitivement.
  const traites = candidats.slice(0, examines);
  const parCle = new Map(apports.map((a) => [a.cle, a]));

  let trouves = 0;
  let synopsis = 0;
  let genres = 0;

  for (const c of traites) {
    const apport = parCle.get(String(c.id));
    if (!apport) continue;

    // Les besoins ont été calculés avant la vague : les revérifier ici coûte
    // peu, et poser un champ rempli entre-temps l'écraserait.
    const set: {
      couvertureUrl?: string;
      synopsis?: string;
      genre?: string;
      sousGenre?: string;
    } = {};

    if (apport.couverture && c.sansCouverture) {
      set.couvertureUrl = apport.couverture.url;
      trouves += 1;
    }
    if (apport.synopsis && !c.synopsis) {
      set.synopsis = apport.synopsis;
      synopsis += 1;
    }
    if (apport.genre && !c.genre) {
      set.genre = apport.genre;
      // Le sous-genre ne voyage jamais seul : posé sous un genre saisi à la
      // main, il pourrait contredire ce que la lectrice a choisi.
      if (apport.sousGenre && !c.sousGenre) set.sousGenre = apport.sousGenre;
      genres += 1;
    }
    if (Object.keys(set).length === 0) continue;

    await db.update(livres).set(set).where(eq(livres.id, c.id));
  }

  // Les fiches encore incomplètes, nommées et non plus seulement comptées.
  // « 8 fiches restent incomplètes » n'aide pas : il faut savoir lesquelles,
  // et ce qui leur manque, pour aller le saisir. Le compte total vient de la
  // même requête, plafonnée à l'affichage seulement.
  const incompletes = await db
    .select({
      id: livres.id,
      titre: livres.titre,
      auteur: livres.auteur,
      sansCouverture: SANS_COUVERTURE.as("sans_couverture"),
      sansSynopsis: sql<boolean>`${livres.synopsis} is null or ${livres.synopsis} = ''`,
      sansGenre: sql<boolean>`${livres.genre} is null or ${livres.genre} = ''`,
    })
    .from(livres)
    .where(and(eq(livres.utilisateurId, utilisateurId), INCOMPLETE))
    .orderBy(livres.titre);

  return {
    traites: traites.length,
    trouves,
    synopsis,
    genres,
    substituts,
    restants: incompletes.length,
    /** Plafonnée : au-delà, la liste cesse d'être une liste de tâches. */
    incompletes: incompletes.slice(0, 30),
    curseur: traites.length ? traites[traites.length - 1].id : apresId,
  };
}
