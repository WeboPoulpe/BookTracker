"use client";

import Dexie, { type EntityTable } from "dexie";

/**
 * File de synchro des écritures.
 *
 * L'app fonctionne principalement en ligne : la lecture hors ligne est
 * assurée par le cache du service worker, pas par une copie locale de la
 * bibliothèque. Ce module ne garde donc que ce que le cache HTTP ne sait pas
 * faire — retenir une saisie faite sans réseau et la rejouer au retour.
 */

export type Operation = "creer" | "modifier" | "supprimer" | "session";

export type EnAttente = {
  id: number;
  table: "livres" | "sessions" | "citations";
  operation: Operation;
  /** Corps JSON tel qu'il partira vers l'API, sans retraitement */
  payload: unknown;
  horodatage: number;
  tentatives: number;
  derniereErreur: string | null;
};

class BaseLocale extends Dexie {
  fileSynchro!: EntityTable<EnAttente, "id">;

  constructor() {
    super("ma-bibliotheque");
    this.version(1).stores({
      livres: "id, statut, serieId, titre, auteur",
      fileSynchro: "++id, horodatage, table",
    });
    // La v1 embarquait un miroir de la bibliothèque, jamais relu : les
    // écrans lisent le serveur, le service worker s'occupe du hors ligne.
    // `null` supprime le magasin sur les bases déjà créées.
    this.version(2).stores({ livres: null });
  }
}

/**
 * IndexedDB n'existe pas au rendu serveur. On instancie paresseusement au
 * lieu de tester `typeof window` à chaque appel : le module est importé par
 * des composants qui sont d'abord rendus côté serveur.
 */
let base: BaseLocale | null = null;

function db(): BaseLocale | null {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  base ??= new BaseLocale();
  return base;
}

/* ── File de synchro ─────────────────────────────────────────────────────── */

export async function empiler(
  entree: Omit<EnAttente, "id" | "horodatage" | "tentatives" | "derniereErreur">,
): Promise<number | null> {
  const b = db();
  if (!b) return null;
  return b.fileSynchro.add({
    ...entree,
    horodatage: Date.now(),
    tentatives: 0,
    derniereErreur: null,
  } as EnAttente);
}

export async function enAttente(): Promise<EnAttente[]> {
  const b = db();
  if (!b) return [];
  // L'ordre chronologique n'est pas cosmétique : rejouer une session avant
  // la création du livre qu'elle vise échouerait.
  return b.fileSynchro.orderBy("horodatage").toArray();
}

export async function compterEnAttente(): Promise<number> {
  const b = db();
  if (!b) return 0;
  return b.fileSynchro.count();
}

export async function retirer(id: number) {
  await db()?.fileSynchro.delete(id);
}

export async function marquerEchec(id: number, motif: string) {
  const b = db();
  if (!b) return;
  const entree = await b.fileSynchro.get(id);
  if (!entree) return;
  await b.fileSynchro.update(id, {
    tentatives: entree.tentatives + 1,
    derniereErreur: motif,
  });
}

/* ── Reprise ─────────────────────────────────────────────────────────────── */

export type BilanSynchro = {
  rejouees: number;
  echecs: number;
  abandonnees: number;
};

/** Au-delà, l'entrée est irrécupérable : on la retire pour ne pas bloquer la file. */
const MAX_TENTATIVES = 5;

/**
 * Rejoue la file dans l'ordre.
 *
 * Une entrée en échec réseau reste en file ; une entrée refusée par le
 * serveur (validation, livre supprimé entre-temps) est abandonnée après
 * plusieurs essais, sinon elle bloquerait indéfiniment tout ce qui suit.
 */
export async function rejouer(): Promise<BilanSynchro> {
  const bilan: BilanSynchro = { rejouees: 0, echecs: 0, abandonnees: 0 };
  const file = await enAttente();
  if (file.length === 0) return bilan;

  for (const entree of file) {
    try {
      const r = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: entree.table,
          operation: entree.operation,
          payload: entree.payload,
          horodatage: entree.horodatage,
        }),
      });

      if (r.ok) {
        await retirer(entree.id);
        bilan.rejouees += 1;
        continue;
      }

      // 4xx : le serveur ne changera pas d'avis en réessayant.
      if (r.status >= 400 && r.status < 500) {
        const corps = await r.json().catch(() => null);
        await marquerEchec(
          entree.id,
          corps?.erreur?.message ?? `Refusé (${r.status})`,
        );
        if (entree.tentatives + 1 >= MAX_TENTATIVES) {
          await retirer(entree.id);
          bilan.abandonnees += 1;
        } else {
          bilan.echecs += 1;
        }
        continue;
      }

      await marquerEchec(entree.id, `Serveur (${r.status})`);
      bilan.echecs += 1;
      // Un 5xx touche probablement les entrées suivantes aussi : on s'arrête
      // là plutôt que d'incrémenter les compteurs de toute la file.
      break;
    } catch {
      await marquerEchec(entree.id, "Réseau indisponible");
      bilan.echecs += 1;
      break;
    }
  }

  return bilan;
}
