# Mise en ligne

Hébergement Vercel, base Neon partagée entre le poste et la production.

---

## 1. Pousser sur GitHub

Dans **ton** terminal — Git Credential Manager doit ouvrir une fenêtre
d'authentification, ce qu'un shell non interactif ne peut pas faire :

```powershell
cd "C:\Users\morga\Desktop\SOFT\WEBOOK TRACkER"
git push -u origin main
```

Si Git n'est pas reconnu, ferme et rouvre le terminal : l'installeur a
modifié le PATH, les sessions déjà ouvertes ne le voient pas.

---

## 2. Importer le projet sur Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Choisir `WeboPoulpe/BookTracker`
3. Framework détecté : **Next.js**. Ne rien changer aux commandes de build.
4. **Avant de cliquer Deploy**, ouvrir *Environment Variables* et ajouter
   celles du tableau ci-dessous.

### Variables d'environnement

`DATABASE_URL` est **obligatoire dès le premier build** : `db/index.ts` lève
une erreur si elle manque, et Next importe les modules de routes pendant la
compilation. Sans elle, le build échoue.

| Variable | Valeur | Requise |
|---|---|---|
| `DATABASE_URL` | Copier depuis ton `.env.local` local | **oui** |
| `FUSEAU_HORAIRE` | `Europe/Paris` | non (défaut : `Europe/Paris`) |
| `UTILISATEUR_LOCAL_NOM` | `Morgane` | non (défaut : `Morgane`) |
| `NEXT_PUBLIC_MODE_LOCAL` | `true` | non (défaut : `true`) |
| `UTILISATEUR_LOCAL_ID` | `local` | non (défaut : `local`) |
| `UTILISATEUR_LOCAL_EMAIL` | `maxence@webomax.fr` | non |
| `CRON_SECRET` | Aléatoire, voir §3 | non, mais recommandée |
| `AUTH_SECRET` | Copier depuis `.env.local` | non tant que l'OAuth dort |

> Ne recopie jamais `DATABASE_URL` dans un fichier versionné : elle contient
> le mot de passe Neon en clair.

---

## 3. Activer la sauvegarde automatique

Un cron quotidien à 4 h écrit un instantané JSON de la bibliothèque. Il lui
faut un espace de stockage **hors de la base** — une sauvegarde rangée dans
la base qu'elle protège ne protège de rien.

1. *Storage → Create Database → Blob*, puis relier le store au projet.
   Vercel ajoute alors `BLOB_READ_WRITE_TOKEN` de lui-même.
2. Ajouter `CRON_SECRET` avec une valeur aléatoire :
   `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
   Vercel signe ses appels de cron avec ; sans elle, connaître l'URL
   suffirait à déclencher la sauvegarde depuis n'importe où.
3. Redéployer.

Tant que le stockage n'est pas configuré, le cron **journalise et passe** au
lieu d'échouer : rien ne casse, mais rien n'est sauvegardé non plus. Le
bouton *Sauvegarder maintenant* des réglages permet de le vérifier sans
attendre 4 h du matin.

> Le plan Hobby limite les crons à une exécution par jour et les déclenche à
> ±59 min de l'heure demandée. Sans importance pour une sauvegarde.

---

## 4. Régler la région des fonctions

*Settings → Functions → Function Region* → **London (lhr1)**

Neon est hébergé en `eu-west-2`, c'est-à-dire Londres. Une fonction restée
sur le défaut américain ferait un aller-retour transatlantique à chaque
requête — plusieurs centaines de millisecondes ajoutées à chaque écran.

Puis *Deployments → Redeploy* pour que le changement prenne effet.

---

## 5. Vérifier

Sur ton téléphone, à l'adresse `.vercel.app` :

- [ ] Les écrans se chargent et la tapbar navigue
- [ ] **Installer l'app** — Safari : Partager → Sur l'écran d'accueil.
      Chrome : menu → Installer l'application.
- [ ] Ouverte depuis l'écran d'accueil, l'app est en plein écran, sans barre
      d'URL, et les marges d'encoche sont respectées
- [ ] Enregistrer une page : moins de 5 secondes, chronomètre en main
- [ ] **Mode avion** : les écrans déjà visités s'ouvrent, une saisie affiche
      le bandeau « Hors ligne », et au retour du réseau un bandeau confirme
      l'enregistrement
- [ ] *Réglages → Sauvegarder maintenant* rend un bilan chiffré

Le service worker n'existe qu'en production — ce test est impossible en
`npm run dev`.

---

## Ensuite

Chaque `git push` sur `main` redéploie automatiquement. Les autres branches
obtiennent une URL de prévisualisation.

### Ce qui reste ouvert

**L'app n'a aucune authentification.** Quiconque connaît l'URL peut lire et
modifier la bibliothèque. L'indexation est bloquée (`app/robots.ts`), mais ce
n'est pas une protection. Décision assumée le temps de juger le design ; à
reprendre avant de diffuser l'adresse.

### Si le build échoue

| Message | Cause |
|---|---|
| `DATABASE_URL manquant` | Variable non saisie avant le premier déploiement |
| Erreur de type sur `app/sw.ts` | Le service worker se vérifie à part : `npm run typecheck` |
| `Serverless Functions ... single region` | Retirer toute clé `regions` de `vercel.json` |
| `limited to daily cron jobs` | Le plan Hobby refuse plus d'une exécution par jour |
