"use client";

import { empiler, type Operation } from "./offline";

export type Resultat<T = unknown> =
  | { statut: "ok"; data: T }
  | { statut: "en_file" }
  | { statut: "erreur"; message: string };

type Envoi = {
  url: string;
  methode: "POST" | "PATCH" | "DELETE";
  corps?: unknown;
  /** Description de la mutation pour la file de synchro */
  file: { table: "livres" | "sessions" | "citations"; operation: Operation };
};

/**
 * Envoie une mutation, ou la met en file si le réseau manque.
 *
 * Toutes les écritures de l'app passent par ici. C'est aussi la raison pour
 * laquelle les mutations sont des routes API et non des Server Actions (§11) :
 * une Server Action n'est pas un appel qu'on peut sérialiser et rejouer.
 */
export async function envoyer<T = unknown>({
  url,
  methode,
  corps,
  file,
}: Envoi): Promise<Resultat<T>> {
  // Inutile de faire expirer une requête pour apprendre ce que le navigateur
  // sait déjà. `onLine` à `true` ne garantit rien, d'où le try/catch ensuite.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const id = await empiler({ ...file, payload: corps ?? null });
    return id === null
      ? { statut: "erreur", message: "Stockage local indisponible." }
      : { statut: "en_file" };
  }

  try {
    const r = await fetch(url, {
      method: methode,
      headers: corps ? { "Content-Type": "application/json" } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
    });

    if (r.ok) {
      const data = (await r.json().catch(() => null)) as T;
      return { statut: "ok", data };
    }

    // 4xx : la saisie est en cause, la mettre en file ne ferait que
    // repousser le même refus. On rend la main tout de suite.
    if (r.status >= 400 && r.status < 500) {
      const corpsErreur = await r.json().catch(() => null);
      return {
        statut: "erreur",
        message: corpsErreur?.erreur?.message ?? `Refusé (${r.status})`,
      };
    }

    const id = await empiler({ ...file, payload: corps ?? null });
    return id === null
      ? { statut: "erreur", message: `Serveur indisponible (${r.status}).` }
      : { statut: "en_file" };
  } catch {
    // Coupure réseau en plein vol : c'est le cas nominal du §8.
    const id = await empiler({ ...file, payload: corps ?? null });
    return id === null
      ? { statut: "erreur", message: "Réseau indisponible." }
      : { statut: "en_file" };
  }
}
