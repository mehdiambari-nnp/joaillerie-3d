# Firebase : mise en route

Tout l'hébergement passe par Firebase : pages (Hosting), comptes joailliers (Authentication), modèles partagés (Cloud Storage), projets synchronisés (Firestore).
Le mode « offline » (`npm run dev:offline`, `--mode offline`, projets sur l'appareil, API `/api/models` en mémoire) sert uniquement aux tests et au développement hors ligne.

## À faire une fois (≈ 20 min)
1. Console Firebase → **Créer un projet** (ex. `domuse`). Passer au plan **Blaze** (carte requise, usage actuel quasi gratuit). Une **alerte de budget** (1 € / mois, seuils 50 / 80 / 100 %) est configurée sur le projet de production : à recréer pour tout nouveau projet (console Google Cloud → Facturation → Budgets et alertes).
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
Fichiers : `firestore.rules`, `storage.rules`. Testées sur l'émulateur : `npm run test:rules` (69 tests, Java requis, arrêter d'abord les émulateurs de développement).
- **Comptes** : `signedIn()` = compte réel (e-mail, Google). Les **comptes anonymes** (clients d'un lien suivi) ne peuvent écrire que leur propre ligne de consultation.
- **Storage** `models/{empreinte}` : lecture par quiconque a l'identifiant (lien client), pas de listing ; création réservée aux joailliers connectés, 60 Mo max, jamais d'écrasement.
- **Firestore** : `shares` (liens courts `#s=`, lecture par identifiant) · `users/{uid}/projects` (propriétaire, et invités selon leurs droits) · `workspaces/{owner}/members` et `invites` (ateliers) · `links`, `users/{uid}/links`, `links/{id}/views` (liens clients suivis).
- **Règle d'or du déploiement** : déployer les règles **avant** le site quand elles changent.

## Raccourci : tout déployer en une commande
Depuis le dépôt, sur ton ordinateur : `npx firebase login`, puis `npm run deploy:all` (règles Firestore et Storage + index + Hosting). Reste le CORS du bucket, à faire une fois dans Google Cloud Shell (console.cloud.google.com, icône `>_`) :
`echo '[{"origin":["*"],"method":["GET","HEAD"],"maxAgeSeconds":3600}]' > cors.json && gcloud storage buckets update gs://jewel3d-e8caa.firebasestorage.app --cors-file=cors.json`

## Ateliers partagés et invitations
L'**atelier** d'un joaillier = ses projets (`users/{uid}/projects`). Il peut y **inviter d'autres joailliers** (menu → *Joailliers* → *Inviter un joaillier*) :
- l'app crée un **lien à usage unique, valable 7 jours** (`…/#i=<jeton secret de 128 bits>`), à envoyer à la personne (bouton e-mail prérempli, copie, partage) ;
- la personne ouvre le lien, se connecte ou crée son compte, puis accepte : elle accède aux projets de l'atelier **selon les droits que le propriétaire lui donne** (voir plus bas ; par défaut : voir les projets non privés, créer et modifier) ; un sélecteur *Atelier* apparaît dans son menu ;
- **tout ce qu'un invité enregistre appartient à l'atelier du propriétaire** (il le garde si l'invité part) ; chaque projet affiche qui l'a modifié en dernier ;
- le propriétaire **retire** un joaillier à tout moment, ou annule une invitation en attente ; un invité peut **quitter** l'atelier. Un invité ne peut pas inviter à son tour dans l'atelier d'un autre.

Données : `invites/{jeton}`, `workspaces/{owner}/members/{uid}`, `users/{uid}/memberships/{owner}` (index inverse). Les règles imposent l'usage unique (le jeton est marqué utilisé *dans la même écriture groupée* que l'adhésion), l'expiration et l'identité ; elles sont testées sur l'émulateur : `npm run test:rules` (Java requis, lancé aussi par la CI). **Déployer les règles avant le site** : `npx firebase deploy --only firestore:rules`.

### Tester en local sans toucher à la production
`npm run emulators` (Auth, Firestore, Storage fictifs, projet `demo-jewel3d`), puis `npm run dev` et ouvrir `http://localhost:5173/?emulator`. Pour simuler deux joailliers dans le même navigateur, utiliser deux origines : `http://localhost:5173/?emulator` et `http://127.0.0.1:5173/?emulator` (les sessions sont séparées).

## Menu et backoffice (tableau de bord, projets, liens, joailliers)
Le menu burger ne contient que des entrées : chacune ouvre une **page** du backoffice (onglets en haut ; barre du bas sur mobile) : *Tableau de bord* (indicateurs sur 7 jours, contacts à relancer, activité récente), *Projets* (recherche, archivage, duplication, renommage, visibilité), *Liens clients*, *Joailliers* (invitations, membres, visibilité).
**Visibilité des projets** : chaque projet porte `private` et `archived` (booléens). Un projet **privé** n'est visible que du propriétaire ; les joailliers invités ne voient que les projets non privés et ne peuvent pas changer la visibilité (règles Firestore). Les projets créés avant cette version n'ont pas ces champs : le propriétaire les complète automatiquement à l'ouverture de ses projets ; **tant que ce n'est pas fait, les invités ne les voient pas**. Déployer les règles avant la mise en ligne : `npx firebase deploy --only firestore --project jewel3d-e8caa`.

## Droits des joailliers invités
Dans *Joailliers*, cliquer sur une personne ouvre sa fiche : le propriétaire y règle (enregistrement immédiat, appliqué par les règles Firestore) :
- **Projets** : *tous les projets visibles* (non privés) ou *sélection uniquement* ; dans les deux cas, un projet peut être **accordé un par un** (`sharedWith` sur le projet, y compris un projet privé).
- **Fonctionnalités** (`workspaces/{owner}/members/{uid}.perms`) : `save` (créer/modifier, **oui** par défaut), `delete` (supprimer, non), `createLinks` (créer des liens clients, non), `viewLinks` (voir tous les liens de l'atelier et leurs statistiques, non). Champs absents = valeurs par défaut ; un invité ne peut jamais fixer ses propres droits.
- Les **liens clients** créés par un invité autorisé appartiennent à l'atelier (`owner` = propriétaire, `by` = auteur). Sans `viewLinks`, l'invité ne voit que ses propres liens, sans statistiques ; il ne gère que les siens.
- Les anciens membres gardent leur accès (tous les projets non privés, créer/modifier) mais **ne peuvent plus supprimer** tant que le propriétaire ne leur a pas donné ce droit. **Déployer les règles avant la mise en ligne** : `npx firebase deploy --only firestore --project jewel3d-e8caa` (répondre **N** à la question sur les surcharges de champs : c'est la politique TTL).

## Liens clients suivis (backoffice « Liens clients »)
Dans *Partager*, le lien client n'est plus générique : le joaillier crée **un lien par envoi** (avec un nom privé, ex. « Mme Dupont – alliance »). Menu → **Liens clients** :
- **Suivi** : consultations, appareils distincts, temps total et moyen (temps *visible à l'écran*), écrin ouvert, essayages sur la main, photos, appareil principal, historique détaillé (date, durée, appareil, actions), graphique sur 14 jours, repère d'**intérêt** (faible / moyen / fort).
- **Actions** : désactiver / réactiver (le client voit « Ce lien n'est plus disponible »), supprimer (lien, fiche et historique), modifier (nom, note privée, date d'expiration), **mettre à jour la configuration** avec la bague actuelle (même lien, nouveau contenu), copier, ouvrir, QR.
- Les anciens liens `#s=` / `#c=` continuent de fonctionner, **sans suivi**.

**Données et vie privée** : `links/{id}` (public : configuration, propriétaire, actif, expiration), `users/{uid}/links/{id}` (fiche privée), `links/{id}/views/{vid}` (une ligne par ouverture). Le client reçoit un **compte anonyme** Firebase pour écrire sa consultation. On mesure : date, durée visible, actions (écrin / essayage / photo), type d'appareil, système, navigateur, langue. **Jamais** : adresse IP, localisation, identité. Un joaillier connecté qui teste son propre lien n'est pas compté. **Information du client** : un bandeau discret « Mesure d'audience anonyme de ce lien. En savoir plus » est visible dès l'ouverture (écrin compris) ; la page détaille ce qui est / n'est pas enregistré, la conservation (13 mois), et permet de **refuser la mesure** à tout moment (mémorisé sur l'appareil, la mesure s'arrête aussitôt). Le texte est à **faire valider par votre conseil** (RGPD, ePrivacy) : le joaillier est le responsable du traitement.
Les règles interdisent aux comptes anonymes tout autre écrit (projets, liens courts, invitations, dépôt de modèles) et plafonnent le temps déclaré au temps réellement écoulé.

### Déploiement des règles et des index
- Règles seules : `npx firebase deploy --only firestore:rules --project jewel3d-e8caa` (aucune question).
- Règles + index : `npx firebase deploy --only firestore --project jewel3d-e8caa` (index : requête de groupe sur `views.owner`). Firebase demande alors s'il faut **supprimer les surcharges de champ** `views.expireAt` : c'est la **politique TTL** (suppression automatique des consultations après 13 mois) ; **répondre N**. Répondre `y` (ou utiliser `--force`) la désactiverait et rendrait fausse la phrase affichée au client.
- **Conservation de 13 mois** : chaque consultation porte un champ `expireAt` ; la suppression automatique s'active une fois : `gcloud firestore fields ttls update expireAt --collection-group=views --enable-ttl --project=jewel3d-e8caa` (déjà fait en production).
- Authentication → *Sign-in method* → **Anonyme** activé (mesure des liens clients).
- Puis fusion de la PR : la CI déploie le site (aperçu par PR, production sur `main`).
