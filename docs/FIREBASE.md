# Firebase : mise en route

Tout l'hébergement passe par Firebase : pages (Hosting), comptes joailliers (Authentication), modèles partagés (Cloud Storage), projets synchronisés (Firestore).
Sans configuration Firebase dans le thème, l'application reste en mode « local » (projets sur l'appareil, API `/api/models`) : c'est le mode des tests et du développement.

## À faire une fois (≈ 20 min)
1. Console Firebase → **Créer un projet** (ex. `domuse`). Passer au plan **Blaze** (carte requise, usage actuel quasi gratuit ; ajouter une alerte de budget).
2. **Build → Authentication** → Commencer → activer **E-mail/Mot de passe** et **Google**. Dans *Paramètres → Domaines autorisés*, ajouter le domaine de production.
3. **Build → Firestore Database** → Créer (mode production, région `eur3` ou `europe-west9`).
4. **Build → Storage** → Commencer (même région).
5. **Paramètres du projet → Vos applications → Web (`</>`)** → copier l'objet `firebaseConfig`.
6. Coller cet objet dans `themes/<client>/theme.json`, clé `"firebase"` :
   `"firebase": { "apiKey": "…", "authDomain": "…", "projectId": "…", "storageBucket": "…", "messagingSenderId": "…", "appId": "…" }`
   (ces valeurs sont publiques par conception ; la sécurité vient des règles).
7. Mettre l'identifiant du projet dans `.firebaserc`.
8. En local : `npx firebase login`, puis `npm run deploy:rules` (règles Firestore et Storage).
9. CORS du bucket Storage (nécessaire pour télécharger les modèles depuis le navigateur) :
   `gcloud storage buckets update gs://<projectId>.firebasestorage.app --cors-file=storage.cors.json`
   (ou `gsutil cors set storage.cors.json gs://<bucket>`). Le nom exact du bucket est affiché dans Storage.
10. Déploiement automatique (GitHub Actions, `.github/workflows/firebase-hosting.yml`) :
    - `firebase init hosting:github` crée le compte de service et le secret `FIREBASE_SERVICE_ACCOUNT` ; ou, à la main, créer une clé de compte de service (rôles *Firebase Hosting Admin* et *Service Account User*) et l'ajouter en secret du dépôt.
    - Ajouter la variable de dépôt `FIREBASE_PROJECT_ID`.
    - Un aperçu est publié à chaque PR, la production à chaque push sur `main`.
11. Une fois Firebase en production : domaine personnalisé dans *Hosting*, puis retirer Netlify (`netlify.toml`, dossier `netlify/`, dépendance `@netlify/blobs`).

## Règles de sécurité (résumé)
- **Storage** `models/{empreinte}` : lecture par quiconque a l'identifiant (lien client), pas de listing ; création réservée aux joailliers connectés, 60 Mo max, jamais d'écrasement.
- **Firestore** `users/{uid}/projects/{id}` : lecture et écriture réservées au propriétaire.
