# Ma Bibliothèque — spécification technique

> Application de suivi de lecture. Next.js 15 · PWA mobile-first · Tailwind v4 · Neon Postgres.
> Cahier des charges dérivé de l'analyse comparative de 11 trackers du marché : on garde ce qui
> manquait à chacun (suivi de séries, import Goodreads, interface française, usage mobile réel)
> et on jette ce qui les plombait (formules cassables, anglais forcé, données prisonnières).

---

## 1. Le problème qu'on résout

Les trackers vendus sur Etsy sont des tableurs Google Sheets. Trois défauts structurels :

| Défaut observé | Conséquence | Notre réponse |
|---|---|---|
| Formules fragiles, cellules protégées | L'utilisateur casse le fichier et doit réparer lui-même | Base relationnelle, aucune formule à maintenir |
| Saisie au clavier dans une grille | Insupportable sur mobile — or c'est là qu'on lit | Saisie mobile-first, 1 geste = 1 log |
| Interface anglaise, données enfermées | Friction quotidienne, pas de sortie | FR natif, export CSV/JSON à tout moment |

**Le job de l'app :** enregistrer une session de lecture en moins de 5 secondes, depuis le lit,
d'une seule main, sans réseau.

---

## 2. Fonctionnalités — par priorité

### P0 — MVP (sans ça, l'app ne sert à rien)

- **Bibliothèque** : ajout d'un livre par recherche ISBN/titre (Open Library), ou saisie manuelle.
- **Statuts** : `à lire` · `en cours` · `lu` · `abandonné` · `en pause`.
  `en pause` est indispensable : une saga qu'on met de côté n'est ni lue ni abandonnée.
- **Session de lecture** : page actuelle OU minutes écoutées → progression, rythme, date de fin estimée.
- **Suivi de séries** : tome N sur M, barre de progression, « prochain tome à lire ».
  *C'est le critère qui éliminait la moitié des produits du marché.*
- **Import CSV Goodreads** : mapping complet (§6). Point d'entrée obligatoire — une bibliothèque
  vide est une app abandonnée.
- **Export** : CSV Goodreads + JSON complet. Toujours accessible, jamais derrière un paywall.
- **PWA installable, fonctionnelle hors ligne** en lecture + écriture (file d'attente de synchro).

### P1 — Ce qui donne envie de revenir

- **Étagère visuelle** : les tranches colorées (§7, élément signature).
- **Tableau de bord** : livres/pages de l'année, série de jours consécutifs, rythme mensuel,
  genre dominant, top auteurs, taux d'abandon.
- **Notation multi-critères** : note globale en demi-étoiles + 4 axes optionnels
  (`intensité`, `émotion`, `noirceur`, `romance`). Repris du n°1, c'est ce qui distingue
  un « 4/5 thriller » d'un « 4/5 historique ».
- **PAL priorisée** : glisser-déposer entre `Envie` → `Bientôt` → `Suivant`, plus un bouton
  « Choisis pour moi » (tirage pondéré par la priorité).
- **Humeur post-lecture** : un mot + un emoji. C'est ce qu'on relit avec plaisir un an après.
- **Citations** : texte + page + livre source.

### P2 — Plus tard

- Défi de lecture annuel (25 cases, validation automatique par métadonnée).
- Liste d'envies avec prix et date de sortie.
- Carte thermique 365 jours.
- Partage d'une citation en image PNG.
- Thèmes clair / sombre.

### Hors périmètre (assumé)

Recommandations IA, réseau social, notation publique, scan de code-barres en v1.

---

## 3. Stack

```
Next.js 15 (App Router, Server Actions)   — rendu + API dans un seul projet
TypeScript strict
Tailwind CSS v4                            — config CSS-first, pas de tailwind.config.js
Neon Postgres (serverless)                 — driver @neondatabase/serverless sur HTTP
Drizzle ORM + drizzle-kit                  — migrations versionnées
Serwist (@serwist/next)                    — service worker (next-pwa n'est plus maintenu)
Dexie                                      — IndexedDB : cache local + file de synchro
Auth.js v5                                 — Google + magic link
Zod                                        — validation partagée client/serveur
Vercel                                     — hébergement, même région que Neon (eu-central-1)
```

**Pourquoi Neon :** branches de base de données par branche Git, scale-to-zero (coût nul quand
l'app dort), driver HTTP compatible edge runtime. Le plan gratuit suffit largement pour un usage
personnel.

**Piège à connaître :** en serverless, n'ouvre jamais de pool `pg` classique. Utilise
`drizzle-orm/neon-http` — une requête HTTP par appel, pas de connexion persistante.

---

## 4. Arborescence

```
ma-bibliotheque/
├─ app/
│  ├─ layout.tsx                 # <html lang="fr">, thème, manifest
│  ├─ page.tsx                   # Tableau de bord
│  ├─ bibliotheque/
│  │  ├─ page.tsx                # Grille de couvertures + filtres
│  │  └─ [id]/page.tsx           # Fiche livre
│  ├─ etagere/page.tsx           # Élément signature
│  ├─ pal/page.tsx               # Priorisation glisser-déposer
│  ├─ series/page.tsx
│  ├─ citations/page.tsx
│  ├─ reglages/
│  │  ├─ page.tsx
│  │  ├─ import/page.tsx         # CSV Goodreads
│  │  └─ export/page.tsx
│  └─ api/
│     ├─ recherche-livre/route.ts   # proxy Open Library (cache 24 h)
│     └─ sync/route.ts              # réconciliation file hors ligne
├─ components/
│  ├─ ui/                        # primitives
│  ├─ Tranche.tsx                # une tranche de livre
│  ├─ SaisieRapide.tsx           # feuille modale de log
│  └─ NoteMultiAxes.tsx
├─ db/
│  ├─ schema.ts                  # Drizzle
│  ├─ index.ts                   # client Neon
│  └─ requetes/                  # requêtes typées, pas de SQL dans les composants
├─ lib/
│  ├─ goodreads.ts               # parseur + mapping import/export
│  ├─ offline.ts                 # Dexie + file de synchro
│  ├─ stats.ts                   # calculs dashboard (testés unitairement)
│  └─ genres.ts                  # référentiel genres → couleur de tranche
├─ public/
│  ├─ manifest.webmanifest
│  └─ icones/                    # 192, 512, maskable
├─ drizzle/                      # migrations générées
└─ app/globals.css               # @theme Tailwind v4 (tokens du §7)
```

---

## 5. Schéma de base

À exécuter dans la console SQL Neon, ou à générer via `drizzle-kit push`.

```sql
create type statut_lecture as enum ('a_lire','en_cours','lu','abandonne','en_pause');
create type format_livre  as enum ('papier','ebook','audio');

create table utilisateurs (
  id            text primary key,
  email         text unique not null,
  objectif_annuel int default 30,
  cree_le       timestamptz default now()
);

create table series (
  id            serial primary key,
  utilisateur_id text not null references utilisateurs(id) on delete cascade,
  nom           text not null,
  auteur        text,
  tomes_total   int,                     -- null = série en cours de publication
  unique (utilisateur_id, nom)
);

create table livres (
  id             serial primary key,
  utilisateur_id text not null references utilisateurs(id) on delete cascade,
  titre          text not null,
  auteur         text not null,
  isbn13         text,
  couverture_url text,
  pages          int,
  duree_minutes  int,                    -- pour l'audio
  format         format_livre default 'papier',
  genre          text,
  sous_genre     text,
  serie_id       int references series(id) on delete set null,
  tome           numeric(4,1),           -- 1, 2, 2.5 (les hors-séries existent)
  statut         statut_lecture default 'a_lire',
  priorite       smallint default 0,     -- colonne PAL : 0 envie → 3 suivant
  note           numeric(2,1),           -- 0 à 5, pas de 0,5
  axe_intensite  smallint,               -- 0-5, nullable
  axe_emotion    smallint,
  axe_noirceur   smallint,
  axe_romance    smallint,
  avis           text,
  humeur         text,
  prix           numeric(6,2),
  date_sortie    date,
  cree_le        timestamptz default now()
);
create index on livres (utilisateur_id, statut);
create index on livres (serie_id, tome);

-- une ligne par lecture : permet les relectures sans écraser l'historique
create table lectures (
  id          serial primary key,
  livre_id    int not null references livres(id) on delete cascade,
  debut       date,
  fin         date,
  abandonnee  boolean default false,
  page_finale int
);

create table sessions (
  id          serial primary key,
  lecture_id  int not null references lectures(id) on delete cascade,
  jour        date not null default current_date,
  page_atteinte int,
  minutes     int,
  note_rapide text
);
create index on sessions (lecture_id, jour);

create table citations (
  id        serial primary key,
  livre_id  int not null references livres(id) on delete cascade,
  texte     text not null,
  page      int,
  cree_le   timestamptz default now()
);
```

**Décisions à retenir**

- `lectures` séparée de `livres` : sans ça, une relecture écrase les dates de la première.
  Aucun tableur du marché ne gère ce cas.
- `tome` en `numeric` : les tomes 2.5 et les préquelles existent (*Les Sept Sœurs* en a).
- `page_atteinte` plutôt que `pages_lues` : on saisit le numéro qu'on a sous les yeux,
  pas une soustraction. La progression se calcule côté app.
- Les axes de notation sont `nullable` : un essai historique n'a pas d'axe romance.

---

## 6. Import Goodreads

Le format Goodreads est le pivot d'échange de l'écosystème. Il est déjà utilisé pour la
bibliothèque existante, donc l'import doit être sans perte.

| Colonne CSV Goodreads | Cible | Traitement |
|---|---|---|
| `Title` | `livres.titre` | extraire `(Nom de la série, #3)` → `series.nom` + `tome` |
| `Author` | `livres.auteur` | Goodreads écrit « Prénom Nom », on garde tel quel |
| `ISBN13` | `livres.isbn13` | nettoyer le format `="9782..."` |
| `Number of Pages` | `livres.pages` | |
| `My Rating` | `livres.note` | `0` signifie « non noté » → `null`, pas zéro |
| `Exclusive Shelf` | `livres.statut` | `read`→`lu`, `to-read`→`a_lire`, `currently-reading`→`en_cours` |
| `Bookshelves` | — | si contient `abandoned` / `dnf` → statut `abandonne` |
| `Date Added` | `lectures.debut` | |
| `Date Read` | `lectures.fin` | |
| `My Review` | `livres.avis` | |

Couvertures : rien dans le CSV. Après import, appel groupé
`https://covers.openlibrary.org/b/isbn/{isbn13}-M.jpg`, en tâche de fond, 10 requêtes par
seconde maximum, avec repli sur une tranche générée (§7) si l'ISBN est inconnu.

**Écran d'import :** aperçu des 20 premières lignes, comptage des lignes rejetées avec le motif,
puis confirmation. Jamais d'import silencieux.

---

## 7. Direction artistique

### Le parti pris

Le vocabulaire visuel vient de la reliure, pas de l'application de productivité : tranches de
livres, papier vélin, dorure à chaud. Les fonds sont pastel et lumineux — un tracker de lecture
n'est pas un tableau de bord financier.

### Tokens

```css
/* app/globals.css — Tailwind v4, configuration CSS-first */
@import "tailwindcss";

@theme {
  --color-encre:    #1B1A2E;  /* texte, tranches sombres — violet profond, pas du noir */
  --color-velin:    #F4F1F7;  /* fond global, papier teinté lilas */
  --color-dragee:   #F2C4D8;  /* accent principal, rose dragée */
  --color-sauge:    #BBD4C4;  /* accent secondaire, états positifs */
  --color-tranche:  #A8C0E8;  /* bleu, éléments de navigation */
  --color-dorure:   #E8B84B;  /* accent rare : objectif atteint, série de jours */

  --font-display: "Bricolage Grotesque", sans-serif;
  --font-lecture: "Newsreader", Georgia, serif;
  --font-ui:      "Schibsted Grotesk", system-ui, sans-serif;
}
```

**Trois rôles typographiques, et une inversion assumée.** Le display (`Bricolage Grotesque`, axe
de largeur variable) porte les titres d'écran. Le corps de texte des contenus — titres de livres,
avis, citations — est en `Newsreader`, une face de labeur : dans une app sur les livres, le
contenu mérite une typo de livre. Le chrome d'interface (boutons, libellés, chiffres) est en
`Schibsted Grotesk`, avec chiffres tabulaires activés pour les statistiques.

Réserve `--color-dorure` à un seul usage par écran, sinon il perd tout effet.

### Élément signature : l'étagère

L'écran `/etagere` affiche la bibliothèque en tranches verticales, défilement horizontal.
Chaque tranche encode de l'information réelle :

- **largeur** proportionnelle au nombre de pages ;
- **couleur** dérivée du genre (référentiel dans `lib/genres.ts`) ;
- **remplissage** vertical = progression de lecture, pour les livres en cours ;
- **liseré doré** sur les 5 étoiles.

Groupement par série, année ou genre. Appui sur une tranche → fiche livre. C'est la seule
animation orchestrée de l'app : au chargement, les tranches se posent en cascade de 40 ms.
Partout ailleurs, transitions sobres.

```
┌──────────────────────────────────────────────┐
│  2026 · 23 livres · 7 412 pages              │
│                                              │
│  ██ ▓▓▓ █ ▒▒▒▒ ██ ▓▓ ████ ░░ ██ ▓▓▓▓ █  →   │
│  └── appui = fiche · appui long = log        │
└──────────────────────────────────────────────┘
```

### Contraintes mobile

- Zones tactiles de 44 px minimum.
- Bouton de saisie rapide flottant en bas à droite, atteignable au pouce.
- Feuille modale (bottom sheet) pour tout formulaire, jamais de pleine page.
- `prefers-reduced-motion` respecté : la cascade devient un fondu.
- Focus clavier visible partout.

### Ton des textes

Verbes actifs, phrases courtes, une majuscule en début seulement.
« Enregistrer ma page », pas « Soumettre ». Un écran vide propose une action :
« Aucun livre en cours. Reprendre *Les Sept Sœurs*, tome 4 ? »

---

## 8. Stratégie hors ligne

C'est le point qui différencie l'app d'un Google Sheets sur mobile.

1. **Lecture** : à l'ouverture, toute la bibliothèque est écrite en IndexedDB via Dexie.
   Les écrans lisent Dexie en premier, puis rafraîchissent depuis Neon.
2. **Écriture** : toute mutation est écrite localement *et* poussée dans une file
   `file_synchro` (`{ id, table, operation, payload, horodatage }`).
3. **Reprise** : au retour du réseau, `POST /api/sync` rejoue la file dans l'ordre.
   En cas de conflit, l'horodatage le plus récent gagne — suffisant pour un usage
   mono-utilisateur, à revoir si l'app devient multi-appareils simultanés.
4. **Service worker** : Serwist, stratégie `NetworkFirst` sur les routes API,
   `CacheFirst` sur les couvertures (elles ne changent jamais).

```json
// public/manifest.webmanifest
{
  "name": "Ma Bibliothèque",
  "short_name": "Bibliothèque",
  "lang": "fr",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#F4F1F7",
  "theme_color": "#1B1A2E",
  "icons": [
    { "src": "/icones/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icones/512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icones/maskable.png", "sizes": "512x512", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Enregistrer ma page", "url": "/?action=log" }
  ]
}
```

---

## 9. Démarrage

```bash
npx create-next-app@latest ma-bibliotheque --ts --tailwind --app --eslint
cd ma-bibliotheque
npm i drizzle-orm @neondatabase/serverless dexie zod next-auth@beta
npm i -D drizzle-kit @serwist/next
```

`.env.local` :

```
DATABASE_URL="postgresql://...@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
AUTH_SECRET="..."
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."
```

`db/index.ts` :

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const db = drizzle(neon(process.env.DATABASE_URL!), { schema });
```

Puis `npx drizzle-kit generate && npx drizzle-kit migrate`.

### Extensions VS Code

`bradlc.vscode-tailwindcss` · `dbaeumer.vscode-eslint` · `esbenp.prettier-vscode` ·
`ms-vscode.vscode-typescript-next` · `mtxr.sqltools` + `mtxr.sqltools-driver-pg` (connexion Neon
directe depuis l'éditeur).

---

## 10. Ordre de construction

| Étape | Livrable | Critère de sortie |
|---|---|---|
| 1 | Schéma Neon + Drizzle + auth | Un livre créé en base depuis un formulaire |
| 2 | Import Goodreads | La bibliothèque existante remonte sans perte |
| 3 | Bibliothèque + fiche livre + statuts | Navigation complète au doigt |
| 4 | Saisie de session + progression | Un log en moins de 5 s, chronomètre en main |
| 5 | Séries | *Les Sept Sœurs* affiche « tome 3 sur 8, en pause » |
| 6 | PWA + hors ligne | Mode avion : consultation et saisie fonctionnelles |
| 7 | Étagère + tableau de bord | L'app donne envie d'être ouverte sans raison |
| 8 | Export | On peut partir avec ses données |

Ne passe pas à l'étape suivante tant que la précédente ne tient pas sur un vrai téléphone.
L'émulateur ment sur les zones tactiles.

---

## 11. Points de vigilance

- **Neon scale-to-zero** : la première requête après inactivité prend ~500 ms. Affiche un
  squelette, jamais un écran blanc.
- **Open Library** est incomplet sur le catalogue francophone. Prévois toujours la saisie
  manuelle avec upload de couverture, et ne bloque jamais un ajout sur l'absence d'ISBN.
- **Tailwind v4** ne lit plus `tailwind.config.js`. Tout passe par `@theme` dans le CSS —
  la moitié des tutoriels en ligne sont périmés sur ce point.
- **Server Actions et hors ligne ne se marient pas.** Les mutations passent par des routes API
  classiques pour pouvoir être rejouées depuis la file. Réserve les Server Actions aux
  formulaires qui exigent le réseau (réglages, import).
- **Sauvegarde** : une tâche cron Vercel hebdomadaire qui écrit un JSON complet dans un blob.
  Une base de données personnelle sans sauvegarde est une perte de données différée.
