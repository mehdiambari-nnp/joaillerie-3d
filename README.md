# Joaillerie 3D — configurateur de bagues

Web app (HTML5 / CSS3 / JS + three.js) : importez un `.fbx` (ou GLB/OBJ), tournez la bague comme sur Sketchfab,
touchez une partie (corps, griffes, chaton, pierres…) et appliquez une matière (or, platine, diamant, émeraude…) en temps réel.
Partage par lien, export GLB/USDZ, **AR Quick Look** (iPhone, désactivée pour l'instant dans l'interface) et **essayage sur la main** (caméra + MediaPipe).

Le rendu et l'import s'exécutent dans le navigateur. Le fichier 3D ne quitte l'appareil que si le joaillier **partage** un lien client ou **enregistre** un projet : il est alors hébergé (Firebase) pour que le client ouvre exactement cette bague.

## Démarrer
```bash
npm install            # copie aussi les wasm MediaPipe (postinstall)
npm run dev            # HTTPS auto-signé, réseau local ; Firebase réel : page de connexion joaillier
npm run dev:offline    # sans Firebase ni connexion (API en mémoire) : tests et développement hors ligne
npm run dev -- --open  # puis ?model=gemv charge assets/test/MAQUETTE_GEMV.fbx (mode offline)
npm test               # tests unitaires (le fichier import.test.js exige la maquette privée assets/test/)
npm run verify         # tests unitaires + build + CSP + E2E (≈ 3 min) : lancé automatiquement avant chaque push (hook git)
npm run test:e2e       # E2E Chromium headless, mode offline (captures dans docs/screenshots/, dossier local non versionné)
npm run build          # dist/ statique (Firebase) ; npm run build:offline pour la variante sans Firebase
npm run emulators      # émulateurs Firebase (Auth/Firestore/Storage) ; ouvrir ?emulator pour s'y brancher
npm run test:rules     # règles de sécurité Firestore sur l'émulateur (Java requis)
npm run deploy:all     # règles Firestore/Storage + Hosting (npx firebase login --reauth si la session a expiré)
```

## Comptes, partage et hébergement
Firebase (projet `jewel3d-e8caa`, site https://jewel3d-e8caa.web.app) : Hosting, Authentication (e-mail + Google, anonyme pour la mesure des liens clients), Cloud Storage (modèles partagés), Firestore (projets, liens, ateliers).
L'outil exige un compte joaillier. Le menu burger ouvre un **backoffice** à quatre pages : *Tableau de bord* (indicateurs, contacts à relancer, activité), *Projets* (recherche, archivage, duplication, visibilité), *Liens clients* (un lien suivi par envoi : consultations, temps passé, essayages, désactivation) et *Joailliers* (invitations par lien à usage unique, **droits de chaque invité** : projets accordés un par un, créer / supprimer, liens clients, statistiques). **Un lien client (`#l=…`, ou ancien `#s=…`) s'ouvre sans compte** (vue client, écrin d'ouverture, mention de mesure anonyme avec droit de refus). Détails, règles de sécurité et déploiement : `docs/FIREBASE.md`.
La CI GitHub déploie sans clé (Workload Identity Federation) : aperçu par PR, production sur `main`. Nouveau domaine : l'ajouter aux *domaines autorisés* d'Authentication.
Options d'URL utiles : `?fx=off` (ancien rendu direct), `?fx=mobile` (profil iPhone), `?intro=1` (force l'écrin), `?debug` (console, en développement uniquement).

## Tester sur iPhone (voir docs/IOS_TESTS.md)
1. Mac/PC et iPhone sur le même Wi‑Fi, `npm run dev`, ouvrir l'URL « Network » (https://192.168.x.x:5173) dans Safari ou Chrome iOS, accepter le certificat.
2. Ouvrir la maquette : bouton ⤒ (sélecteur de fichiers). En développement (`npm run dev`), ajouter `?debug` à l'URL pour une console intégrée (absente du site publié).
3. « Essayer » → caméra → main ouverte, paume ou dos face à l'iPhone.
4. « AR » → Quick Look (USDZ, échelle réelle).

## Architecture
`src/import` (FBX→modèle normalisé mm, doublons, zones, mesure du doigt) · `src/materials` (bibliothèque, fabrique PBR, miniatures)
· `src/core` (viewer three.js à la demande) · `src/selection` (picking BVH) · `src/app.js` (état, zones, historique)
· `src/state` (partage lz-string) · `src/export` + `src/ar` (GLB/USDZ/Quick Look) · `src/tryon` (MediaPipe, pose, filtre One Euro, occlusion) · `src/intro` (écrin d'ouverture)
· `src/cloud` (Firebase : projets, ateliers, liens suivis, droits ; `local.js` pour le mode offline) · `src/ui` (interface ; `menu.js`, `backoffice.js` et `pages/` : menu et pages du joaillier).
Les règles de sécurité sont dans `firestore.rules` et `storage.rules`, testées sur l'émulateur (`tests/rules/`).
Repère normalisé : mm, axe du doigt = +Z, dessus (pierres) = +Y. Journal des décisions : `DECISIONS.md`. Brief d'origine (historique) : `docs/BRIEF.md`.

## Limites connues (honnêtes)
- Les tests automatisés tournent en Chromium headless (WebGL logiciel, caméra simulée) : l'iPhone se vérifie à la main, avec la liste de `docs/IOS_TESTS.md`.
- Non implémentés : rendu HQ lancer de rayons/path tracing, comparateur côte à côte, indicateur de prix, instanciation du pavé, éditeur de matériau libre.
- USDZ : les pierres sont approximées (matériau standard, pas de transmission) — limite d'AR Quick Look. Fichiers AR lourds (GLB ≈ 7 Mo, USDZ ≈ 23 Mo sur la maquette) : décimation à prévoir.
- Essayage : échelle indicative (± quelques %), un seul doigt à la fois, FOV caméra estimé (réglable).
- Le fichier `assets/test/MAQUETTE_GEMV.fbx` est privé : ne pas publier. Voir `assets/LICENSES.md`.

## Crédits
Environnements HDR : [Poly Haven](https://polyhaven.com) (CC0).
