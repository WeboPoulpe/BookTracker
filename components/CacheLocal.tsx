"use client";

import { useEffect } from "react";

import type { LivreListe } from "@/db/requetes/livres";
import { mettreEnCache } from "@/lib/offline";

/**
 * Recopie la bibliothèque rendue par le serveur dans IndexedDB.
 *
 * Aucun rendu : le composant n'existe que pour son effet de bord. Les pages
 * restent des composants serveur — c'est le service worker qui les resert
 * hors ligne — et Dexie sert de source aux écrans qui devront lire
 * localement en premier.
 */
export function CacheLocal({ livres }: { livres: LivreListe[] }) {
  useEffect(() => {
    if (livres.length === 0) return;
    void mettreEnCache(livres);
  }, [livres]);

  return null;
}
