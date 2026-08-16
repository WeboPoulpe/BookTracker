# Ma Bibliothèque

Application de suivi de lecture. Next.js 15 · PWA mobile-first · Tailwind v4 · Neon Postgres.

Le cahier des charges complet vit dans [SPECIFICATION.md](SPECIFICATION.md),
la mise en ligne dans [DEPLOIEMENT.md](DEPLOIEMENT.md).

## Démarrer

```bash
npm install
cp .env.example .env.local     # puis renseigner DATABASE_URL
npx drizzle-kit migrate        # crée les 9 tables
npx tsx scripts/init-db.ts     # crée l'utilisateur local
npm run dev
```

L'app écoute sur `http://localhost:3000`, et sur l'IP réseau affichée au
démarrage — c'est par là qu'on la teste sur un vrai téléphone. L'émulateur
ment sur les zones tactiles.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run db:generate` | Génère une migration depuis `db/schema.ts` |
| `npm run db:migrate` | Applique les migrations en attente |
| `npm run db:studio` | Explorateur de base Drizzle |
| `npx tsx scripts/generer-icones.ts` | Régénère les icônes PWA |

## Repères d'architecture

- **`db/requetes/`** — toutes les requêtes SQL. Aucun SQL dans les composants.
- **`app/api/`** — les mutations passent par des routes classiques, pas des
  Server Actions : c'est la condition pour pouvoir les rejouer depuis la file
  de synchro hors ligne.
- **`lib/validation.ts`** — schémas Zod partagés client/serveur. Une mutation
  rejouée n'est pas passée par le formulaire, elle est revalidée à l'arrivée.
- **`app/globals.css`** — tous les tokens de design. Tailwind v4 ne lit plus
  `tailwind.config.js`.
- **`lectures` ≠ `livres`** — une ligne par lecture, pour que les relectures
  n'écrasent pas l'historique.

## État d'avancement

Voir l'ordre de construction au §10 de la spécification.

- [x] Schéma Neon + Drizzle
- [x] Shell d'application, navigation en tapbar, direction artistique
- [x] Ajout de livre (recherche Open Library + saisie manuelle)
- [x] Bibliothèque, fiche livre, statuts
- [x] Saisie de session et progression
- [x] Import Goodreads (aperçu, dédoublonnage, couvertures a posteriori)
- [x] Séries — « tome N sur M », prochain tome à lire
- [x] Étagère + tableau de bord
- [x] PAL priorisée + « Choisis pour moi »
- [x] Citations
- [x] Export CSV Goodreads + JSON complet
- [x] PWA + hors ligne (Serwist, file de synchro Dexie)

Écarts assumés par rapport à la spécification :

- **PAL** — la repriorisation se fait par appui sur la colonne cible, pas par
  glisser-déposer. Le geste tactile fiable demanderait `@dnd-kit` ; l'appui
  fonctionne dès maintenant, y compris au lecteur d'écran.
- **Authentification — absente, et c'est un point à reprendre.** Avec
  `NEXT_PUBLIC_MODE_LOCAL=true`, toute personne connaissant l'URL accède à la
  bibliothèque **et peut la modifier** : `utilisateurCourantId()` renvoie
  `"local"` pour n'importe quel visiteur. Décision assumée le temps de juger
  le design sur mobile, à condition de ne pas diffuser l'URL. L'indexation
  est bloquée (`app/robots.ts`), mais ce n'est pas une protection.

  Pour une app mono-utilisateur, un mot de passe et un cookie signé
  suffiraient : Google apporterait une identité dont personne n'a l'usage,
  puisque tout le monde se connecte au même compte. Le point de bascule est
  isolé dans `lib/utilisateur.ts`.
- **Lecture hors ligne** — assurée par le cache du service worker, et c'est
  volontaire : pas de lecture Dexie-first, l'app tourne principalement en
  ligne. Les pages déjà visitées s'ouvrent sans réseau, une page jamais
  ouverte affiche `/hors-ligne`.
- **Synchronisation Kindle** — impossible : Amazon n'expose aucune API de
  progression de lecture, et l'API Goodreads est fermée. Seule voie stable si
  besoin un jour : importer `My Clippings.txt` depuis la liseuse en USB pour
  alimenter les citations.

## Direction artistique

Papeterie romantique : on prolonge le vocabulaire du §7 (reliure, vélin,
dorure) en le réchauffant. Le rose dragée passe d'accent décoratif à couleur
d'action, les ombres se teintent au lieu de grisailler, les angles
s'arrondissent franchement.

- **Tous les tokens vivent dans `app/globals.css`.** Tailwind v4 ne lit plus
  `tailwind.config.js` — la moitié des tutoriels en ligne sont périmés là-dessus.
- **`lib/anim.ts` centralise le vocabulaire d'animation.** Trois composants qui
  choisissent chacun leur ressort donnent une app qui paraît bricolée, même
  quand chaque animation prise isolément est réussie.
- **`layoutId` partout où un indicateur se déplace** (tapbar, filtres,
  segments, statuts) : Motion interpole la pastille au lieu de la faire
  disparaître puis réapparaître. C'est ce glissement qui fait « natif ».
- **La dorure reste réservée à un usage par écran** (§7), sinon elle perd tout
  effet : objectif atteint, série de jours, liseré des 5 étoiles.
- **`prefers-reduced-motion` est respecté partout**, y compris par les
  confettis et le compteur incrémental.

Coût : Motion ajoute environ 48 ko au premier chargement. Acceptable pour une
PWA que le service worker met en cache, mais c'est le premier endroit où
regarder si le démarrage à froid devient long.

## Recherche de livre

Deux catalogues interrogés en parallèle, car aucun ne suffit seul :

| | Open Library | BnF (API SRU) |
|---|---|---|
| Catalogue français | troué | dépôt légal complet |
| Pagination | oui | non |
| Couverture | oui | non |
| Genre | oui | non |
| Clé d'API | non | non |

Les résultats sont fusionnés (ISBN, sinon titre + auteur normalisés) : une même
édition prend le titre français de la BnF et la pagination d'Open Library.

**Le classement part du rang d'origine de chaque source.** Trier sur la seule
richesse des métadonnées remontait des livres sans rapport au motif qu'ils
avaient une couverture — « Les sept petits musiciens » pour « les sept sœurs ».
La langue et les métadonnées ne servent plus qu'à départager.

**Pas de `signal` sur ces `fetch`.** Combiné au cache de données de Next
(`next: { revalidate }`), un `AbortSignal` laisse la requête en suspens
jusqu'à expiration : le garde-fou devient la panne. Le plafond de durée est
appliqué par `avecDelai` dans `lib/recherche.ts`.

> Note d'environnement : sur ce poste, `fetch` (undici) reçoit un `ECONNRESET`
> d'`openlibrary.org` là où `node:https` et PowerShell passent — probablement
> une inspection TLS locale. La BnF n'est pas affectée, et l'app fonctionne
> quand même : c'est précisément ce que la double source garantit.

## Fiche livre

Tout y est modifiable et supprimable : métadonnées, note, sessions, lectures,
citations, et le livre lui-même.

- **`synopsis` et `resume` sont deux champs distincts.** Le premier est la
  quatrième de couverture, le second le rappel personnel de l'intrigue —
  indispensable sur une saga, où deux ans séparent parfois deux tomes et où
  la quatrième de couverture ne rappelle jamais où l'on s'est arrêté.
- **Le statut ne s'édite pas dans le formulaire de métadonnées** : il ouvre ou
  clôt une lecture. Il reste sur les pastilles de la fiche.
- **Les suppressions ne passent pas par la file hors ligne.** Rejouer une
  suppression sur des identifiants devenus obsolètes ferait plus de dégâts
  que d'attendre le réseau, et effacer une session est rare et sans urgence.
- **Les données partagées entre serveur et client vivent dans `lib/`.** Une
  constante exportée d'un module `"use client"` arrive dans un composant
  serveur sous forme de référence, pas de valeur : `AXES.map` y échoue avec
  « is not a function ». D'où `lib/notation.ts`.

## Accueil et statistiques : une seule source

**L'accueil et l'écran Statistiques appellent la même fonction**
(`statistiques()`), pour la même année. Ils ne peuvent donc pas se
contredire. Ce n'était pas le cas avant : l'accueil calculait son « genre
dominant » sur toute la bibliothèque, l'écran Statistiques sur les seules
lectures de la période — deux mesures différentes sous le même nom, qui
tombaient juste par hasard.

`db/requetes/stats.ts` ne garde que ce qui est propre à l'accueil : les
lectures en cours et la taille de la bibliothèque.

Contrôle de non-régression : `npx tsx scripts/comparer-stats.ts` confronte
les deux écrans mesure par mesure.

## Statistiques

Onglet `/statistiques`, avec une portée réglable : toutes les années, une
année, ou un mois.

**Les statistiques comptent des *lectures*, pas des livres.** Une relecture
compte pour deux — c'est le sens de « livres lus cette année ». Les lectures
abandonnées sont exclues : elles ont une date de fin, mais les compter
fausserait autant la moyenne de pages que le total.

**Chaque barre renvoie aux livres qu'elle compte**, via les filtres d'URL de
`/bibliotheque` (`annee`, `mois`, `genre`, `format`, `note`, `pages`,
`auteur`). Un bandeau y rappelle le filtre actif et permet d'en sortir.

Règles de visualisation appliquées :

- **Jamais deux échelles sur un même axe.** « Livres par mois » et « pages par
  mois » sont deux graphiques distincts ; les superposer laisserait lire des
  corrélations inventées.
- **Une seule teinte par graphique.** Ce sont des comparaisons de grandeur à
  série unique : c'est la longueur de la barre qui porte la valeur. Colorer
  chaque barre dépenserait le canal d'identité à répéter ce que la longueur
  montre déjà. Seules les tranches de longueur prennent une rampe ordinale,
  où la couleur redit l'épaisseur du livre.
- **Palette validée, pas choisie à l'œil** : rampe rose `#E09BBB → #75294A`
  (clarté monotone, écarts ≥ 0,06, extrémité claire ≥ 2:1 sur blanc, teinte
  unique). Teinte de magnitude `#BC5C85`, à 4,19:1.
- **Valeur en étiquette directe sur chaque barre**, pour rester lisible quand
  la barre est très courte.

Les moyennes se calculent sur les mois réellement couverts, et la moyenne de
pages sur les seuls livres dont la pagination est connue — diviser par le
total ferait chuter la moyenne à cause des livres non renseignés.

### Jeu de démonstration

```bash
npx tsx scripts/donnees-demo.ts --creer      # 40 livres lus sur trois ans
npx tsx scripts/donnees-demo.ts --supprimer  # ne retire que ceux-là
npx tsx scripts/inspecter-lectures.ts        # repère les lectures en double
```

## Genres et sous-genres

16 genres, 112 sous-genres. Le **genre** pilote la couleur des tranches sur
l'étagère (§7) ; le **sous-genre** affine le classement sans introduire de
teinte supplémentaire — trente couleurs de plus rendraient l'étagère illisible
au lieu de l'enrichir.

- La liste déroulante de sous-genres est **filtrée par le genre choisi**, et
  désactivée tant qu'aucun genre n'est sélectionné. Changer de genre vide le
  sous-genre, devenu incohérent.
- Une option **« Autre… »** ouvre une saisie libre : une liste strictement
  fermée finirait par refuser le livre qu'on tient en main, c'est le reproche
  central fait aux tableurs du marché (§1). Une valeur hors référentiel — venue
  d'un import — est réinjectée dans le menu au lieu d'être silencieusement
  perdue.
- **`libelleClassement()` applique le repli** : sous-genre s'il existe, genre
  sinon. Un livre sans sous-genre n'est pas « non classé », il compte pour son
  genre. Utilisé par le regroupement « Par sous-genre » de l'étagère et par le
  palmarès du tableau de bord.

Contrôle : `npx tsx scripts/verifier-genres.ts`.

## Couvertures importées

Les deux catalogues laissent beaucoup de livres sans image, et le CSV
Goodreads n'en apporte aucune. On peut donc en fournir une soi-même, depuis
l'écran d'ajout comme depuis la fiche d'un livre.

- **Compression dans le navigateur** (`lib/image.ts`) : 600 × 900 px maximum,
  WebP si disponible, sinon JPEG. Une photo de téléphone passe de ~4 Mo à
  ~40 ko. L'orientation EXIF est appliquée, sinon une couverture
  photographiée en portrait s'affiche couchée.
- **Table `couvertures` séparée**, et non une colonne de `livres` : l'image
  serait rapatriée par chaque requête de liste alors que les écrans n'ont
  besoin que d'une URL.
- **Servies par `/api/couverture/[id]?v=…`** en cache immuable. L'URL porte
  un numéro de version régénéré à chaque remplacement — le cache ne peut donc
  jamais servir une image périmée, et un ETag évite de relire la base.
- Stockage en base64 plutôt qu'en `bytea` : le driver HTTP de Neon manipule
  le binaire de façon fragile, et 33 % de volume en plus sur 40 ko est
  négligeable.

## Hors ligne

L'app fonctionne **principalement en ligne**. Le hors ligne est un filet, pas
un mode de fonctionnement : le service worker resert ce qui a déjà été vu, et
les écritures faites sans réseau attendent en file. Il n'y a volontairement
pas de copie locale de la bibliothèque — les écrans lisent le serveur.

Le service worker n'est **actif qu'en production** (`npm run build && npm start`) :
en développement il servirait des pages périmées à chaque édition.

- **Lecture** — `NetworkFirst` sur les routes API, `CacheFirst` sur les
  couvertures (elles ne changent jamais), `defaultCache` de Serwist pour les
  pages et les payloads RSC, avec `cacheOnNavigation` pour couvrir les routes
  atteintes via `next/link`.
- **Écriture** — toute mutation passe par `lib/client-api.ts`. Si le réseau
  manque, elle part dans la file Dexie (`lib/offline.ts`) au lieu d'échouer.
- **Reprise** — `components/EtatReseau.tsx` rejoue la file au retour du
  réseau et au montage, dans l'ordre chronologique, via `POST /api/sync`.
  Une entrée refusée par le serveur (livre supprimé entre-temps, charge utile
  invalide) est abandonnée après 5 tentatives pour ne pas bloquer la file.

Chaque charge utile est revalidée côté serveur : elle n'est pas passée par le
formulaire et a pu séjourner des jours dans IndexedDB.

## Remise à zéro

```bash
npx tsx scripts/vider-donnees.ts             # liste ce qui serait supprimé
npx tsx scripts/vider-donnees.ts --confirmer # supprime réellement
```

L'authentification Google est différée : l'app tourne en mono-utilisateur
via `NEXT_PUBLIC_MODE_LOCAL`. Le point de bascule est isolé dans
`lib/utilisateur.ts`.
