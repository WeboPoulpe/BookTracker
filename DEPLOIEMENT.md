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
| `NEXT_PUBLIC_MODE_LOCAL` | `true` | non (défaut : `true`) |
| `UTILISATEUR_LOCAL_ID` | `local` | non (défaut : `local`) |
| `UTILISATEUR_LOCAL_EMAIL` | `maxence@webomax.fr` | non |
| `AUTH_SECRET` | Copier depuis `.env.local` | non tant que l'OAuth dort |

> Ne recopie jamais `DATABASE_URL` dans un fichier versionné : elle contient
> le mot de passe Neon en clair.

---

## 3. Régler la région des fonctions

*Settings → Functions → Function Region* → **London (lhr1)**

Neon est hébergé en `eu-west-2`, c'est-à-dire Londres. Une fonction restée
sur le défaut américain ferait un aller-retour transatlantique à chaque
requête — plusieurs centaines de millisecondes ajoutées à chaque écran.

Puis *Deployments → Redeploy* pour que le changement prenne effet.

---

## 4. Vérifier

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

Le service worker n'existe qu'en production — ce test est impossible en
`npm run dev`.

---

## Ensuite

Chaque `git push` sur `main` redéploie automatiquement. Les autres branches
obtiennent une URL de prévisualisation.

### Sauvegarde

Rien n'est encore en place. Une base personnelle sans sauvegarde est une
perte de données différée (§11) : `GET /api/export?format=json` produit déjà
l'export complet, il reste à l'automatiser via une tâche cron Vercel qui
écrira le résultat dans un blob.

### Si le build échoue

| Message | Cause |
|---|---|
| `DATABASE_URL manquant` | Variable non saisie avant le premier déploiement |
| Erreur de type sur `app/sw.ts` | Le service worker se vérifie à part : `npm run typecheck` |
| `Serverless Functions ... single region` | Retirer toute clé `regions` de `vercel.json` |
