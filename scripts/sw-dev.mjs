/**
 * Remplace public/sw.js par un service worker qui se désinstalle.
 *
 * Lancé avant `next dev` (script `predev`). Sans lui, le service worker
 * produit par un `npm run build` antérieur reste enregistré dans le
 * navigateur pour la même origine : `localhost:3000` sert alors des pages
 * mises en cache des heures plus tôt, et on croit que le code n'a pas changé.
 *
 * Supprimer le fichier ne suffirait pas : quand la requête de mise à jour
 * échoue, le navigateur conserve le service worker déjà installé. Il faut
 * donc lui servir une version qui vide les caches et se retire elle-même.
 *
 * `npm run build` réécrit ensuite le vrai service worker : la production
 * n'est pas concernée.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const KILL_SWITCH = `// Généré par scripts/sw-dev.mjs — ne pas versionner.
// Service worker de développement : il se désinstalle au premier chargement.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (evenement) => {
  evenement.waitUntil(
    (async () => {
      for (const nom of await caches.keys()) {
        await caches.delete(nom);
      }
      await self.registration.unregister();
      // Rechargement des onglets ouverts : sans ça, la page courante
      // continue d'afficher ce que l'ancien service worker lui avait servi.
      for (const client of await self.clients.matchAll({ type: "window" })) {
        client.navigate(client.url);
      }
    })(),
  );
});

// Aucune interception : tout part au réseau.
self.addEventListener("fetch", () => {});
`;

const dossier = join(process.cwd(), "public");
await mkdir(dossier, { recursive: true });
await writeFile(join(dossier, "sw.js"), KILL_SWITCH, "utf8");

console.log("public/sw.js remplacé par le service worker de désinstallation.");
