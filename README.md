# Ma Bibliothèque

Application de suivi de lecture. Next.js 15 · PWA mobile-first · Tailwind v4 · Neon Postgres.

Le cahier des charges complet vit dans [SPECIFICATION.md](SPECIFICATION.md).

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
- [ ] PWA + hors ligne (Serwist, file de synchro Dexie)

Écarts assumés par rapport à la spécification :

- **PAL** — la repriorisation se fait par appui sur la colonne cible, pas par
  glisser-déposer. Le geste tactile fiable demanderait `@dnd-kit` ; l'appui
  fonctionne dès maintenant, y compris au lecteur d'écran.
- **Authentification** — différée, faute d'identifiants Google. Point de
  bascule isolé dans `lib/utilisateur.ts`.
- **Saisie hors ligne** — les mutations passent déjà par des routes API
  rejouables, mais la file Dexie n'est pas encore branchée : sans réseau,
  l'enregistrement échoue au lieu d'être mis en attente.

L'authentification Google est différée : l'app tourne en mono-utilisateur
via `NEXT_PUBLIC_MODE_LOCAL`. Le point de bascule est isolé dans
`lib/utilisateur.ts`.
