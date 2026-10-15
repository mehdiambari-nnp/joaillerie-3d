# Firebase : mise en route

Tout l'hébergement passe par Firebase : pages (Hosting), comptes joailliers (Authentication), modèles partagés (Cloud Storage), projets synchronisés (Firestore).
Le mode « offline » (`npm run dev:offline`, `--mode offline`, projets sur l'appareil, API `/api/models` en mémoire) sert uniquement aux tests et au développement hors ligne.

## À faire une fois (≈ 20 min)
1. Console Firebase → **Créer un projet** (ex. `domuse`). Passer au plan **Blaze** (carte requise, usage actuel quasi gratuit ; ajouter une alerte de budget).
2. **Build → Authentication** → Commencer → activer **E-mail/Mot de passe** et **Google**. Dans *Paramètres → Domaines autorisés*, ajouter le domaine de production.
3. **Build → Firestore Database** → Créer (mode production, région `eur3` ou `europe-west9`).
4. **Build → Storage** → Commencer (même région).
5. **Paramètres du projet → Vos applications → Web (`</>`)** → copier l'objet `firebaseConfig`.
6. Coller cet objet dans `themes/<client>/firebase.json` (valeurs publiques par conception ; la sécurité vient des règles). Elles sont utilisées par tous les builds sauf `--mode offline`.
7. Mettre l'identifiant du projet dans `.firebaserc`.
8. En local : `npx firebase login`, puis `npm run deploy:rules` (règles Firestore et Storage).
9. CORS du bucket Storage (nécessaire pour télécharger les modèles depuis le navigateur) :
   `gcloud storage buckets update gs://<projectId>.firebasestorage.app --cors-file=storage.cors.json`
   (ou `gsutil cors set storage.cors.json gs://<bucket>`). Le nom exact du bucket est affiché dans Storage.
10. Déploiement automatique (GitHub Actions, `.github/workflows/firebase-hosting.yml`) :
    - `firebase init hosting:github` crée le compte de service et le secret `FIREBASE_SERVICE_ACCOUNT` ; ou, à la main, créer une clé de compte de service (rôles *Firebase Hosting Admin* et *Service Account User*) et l'ajouter en secret du dépôt.
    - Ajouter la variable de dépôt `FIREBASE_PROJECT_ID`.
    - Un aperçu est publié à chaque PR, la production à chaque push sur `main`.
11. Domaine personnalisé dans *Hosting*. Netlify a été retiré du dépôt (`netlify.toml`, `netlify/`, `@netlify/blobs`) : les liens `…netlify.app/#s=…` déjà envoyés ne fonctionnent plus (leurs données étaient dans Netlify Blobs).

## Règles de sécurité (résumé)
- **Storage** `models/{empreinte}` : lecture par quiconque a l'identifiant (lien client), pas de listing ; création réservée aux joailliers connectés, 60 Mo max, jamais d'écrasement.
- **Firestore** `users/{uid}/projects/{id}` : lecture et écriture réservées au propriétaire.

## Raccourci : tout déployer en une commande
Depuis le dépôt, sur ton ordinateur : `npx firebase login`, puis `npm run deploy:all` (règles Firestore et Storage + index + Hosting). Reste le CORS du bucket, à faire une fois dans Google Cloud Shell (console.cloud.google.com, icône `>_`) :
`echo '[{"origin":["*"],"method":["GET","HEAD"],"maxAgeSeconds":3600}]' > cors.json && gcloud storage buckets update gs://jewel3d-e8caa.firebasestorage.app --cors-file=cors.json`

## Ateliers partagés et invitations
L'**atelier** d'un joaillier = ses projets (`users/{uid}/projects`). Il peut y **inviter d'autres joailliers** (menu burger → *Joailliers* → *Inviter un joaillier*) :
- l'app crée un **lien à usage unique, valable 7 jours** (`…/#i=<jeton secret de 128 bits>`), à envoyer à la personne (bouton e-mail prérempli, copie, partage) ;
- la personne ouvre le lien, se connecte ou crée son compte, puis accepte : elle **voit, ouvre, modifie, crée et supprime** les projets de l'atelier ; un sélecteur *Atelier* apparaît dans son tiroir ;
- **tout ce qu'un invité enregistre appartient à l'atelier du propriétaire** (il le garde si l'invité part) ; chaque projet affiche qui l'a modifié en dernier ;
- le propriétaire **retire** un joaillier à tout moment, ou annule une invitation en attente ; un invité peut **quitter** l'atelier. Un invité ne peut pas inviter à son tour dans l'atelier d'un autre.

Données : `invites/{jeton}`, `workspaces/{owner}/members/{uid}`, `users/{uid}/memberships/{owner}` (index inverse). Les règles (`firestore.rules`) imposent l'usage unique (le jeton est marqué utilisé *dans la même écriture groupée* que l'adhésion), l'expiration et l'identité ; elles sont testées sur l'émulateur : `npm run test:rules` (Java requis, lancé aussi par la CI). **Déployer les règles avant le site** : `npx firebase deploy --only firestore:rules`.

### Tester en local sans toucher à la production
`npm run emulators` (Auth, Firestore, Storage fictifs, projet `demo-jewel3d`), puis `npm run dev` et ouvrir `http://localhost:5173/?emulator`. Pour simuler deux joailliers dans le même navigateur, utiliser deux origines : `http://localhost:5173/?emulator` et `http://127.0.0.1:5173/?emulator` (les sessions sont séparées).
