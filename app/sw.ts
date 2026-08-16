/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Stratégies propres à l'app, placées AVANT `defaultCache` : Serwist retient
 * la première règle qui correspond, donc une règle générique posée en premier
 * masquerait toutes les suivantes.
 */
const strategies: RuntimeCaching[] = [
  {
    // Les couvertures ne changent jamais. Une fois en cache, on ne
    // redemande plus rien au réseau — c'est ce qui rend la bibliothèque
    // consultable en mode avion sans écrans gris.
    matcher: ({ url }) => url.hostname === "covers.openlibrary.org",
    handler: new CacheFirst({
      cacheName: "couvertures",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 600,
          maxAgeSeconds: 60 * 60 * 24 * 365,
          purgeOnQuotaError: true,
        }),
      ],
    }),
  },
  {
    // Recherche Open Library : le réseau d'abord, mais une réponse déjà vue
    // vaut mieux qu'un écran vide. Court délai avant de basculer sur le
    // cache, sinon on attend le timeout TCP complet dans un train.
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && url.pathname === "/api/recherche-livre",
    handler: new NetworkFirst({
      cacheName: "recherche-livre",
      networkTimeoutSeconds: 5,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 }),
      ],
    }),
  },
  {
    // Lectures de l'API. Les écritures (POST/PATCH/DELETE) ne passent pas
    // par ici : elles sont mises en file dans IndexedDB côté application,
    // ce qui permet de les rejouer dans l'ordre et de les montrer à
    // l'utilisateur. Un Background Sync opaque ne le permettrait pas.
    matcher: ({ url, sameOrigin, request }) =>
      sameOrigin &&
      request.method === "GET" &&
      url.pathname.startsWith("/api/") &&
      url.pathname !== "/api/sync",
    handler: new NetworkFirst({
      cacheName: "api",
      networkTimeoutSeconds: 8,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      ],
    }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: strategies,
  fallbacks: {
    entries: [
      {
        url: "/hors-ligne",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
