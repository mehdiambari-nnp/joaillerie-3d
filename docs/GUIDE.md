# Guide Domuse — configurer, partager, suivre

Domuse est un atelier de bagues en 3D pour joailliers : on importe une bague, on change ses matières en temps réel, on l'envoie à un client par un lien (avec un écrin qui s'ouvre), on voit **si et comment** le client l'a regardée, et on travaille à plusieurs dans un même atelier en choisissant ce que chacun peut faire.

> Les captures de ce guide sont générées automatiquement à partir de l'application réelle (données fictives : la joaillière Claire Moreau et son invité Hugo Bernard). Pour les régénérer après une évolution de l'interface : `npm run emulators` dans un terminal, puis `npm run guide` (voir la fin de ce document).

## Sommaire
1. [Se connecter](#1-se-connecter)
2. [Le configurateur](#2-le-configurateur)
3. [Les projets](#3-les-projets)
4. [Envoyer une bague à un client](#4-envoyer-une-bague-à-un-client)
5. [Ce que voit le client](#5-ce-que-voit-le-client)
6. [Suivre ses clients : tableau de bord et liens](#6-suivre-ses-clients--tableau-de-bord-et-liens)
7. [Travailler à plusieurs : joailliers et droits](#7-travailler-à-plusieurs--joailliers-et-droits)
8. [Sur téléphone](#8-sur-téléphone)
9. [Vie privée](#9-vie-privée)
10. [Pour les développeurs](#10-pour-les-développeurs)

---

## 1. Se connecter
L'espace joaillier demande un compte (e-mail et mot de passe, ou Google). Seul **le lien d'un client** s'ouvre sans compte.

![Page de connexion](images/01-connexion.jpg)

## 2. Le configurateur
Importez un fichier 3D (FBX, GLB ou OBJ) avec le bouton ⤒, ou glissez-le dans la page. L'application reconnaît les parties de la bague : pierre centrale, pierres latérales, chaton, griffes, corps. Tournez la bague avec un doigt, pincez pour zoomer, touchez une partie pour la sélectionner.

![Le configurateur, mode joaillier](images/02-configurateur.jpg)

Pour chaque partie : **métal** (or jaune, rose, champagne, platine… en finition polie, satinée, brossée ou martelée), **pierre** ou **teinte libre**. Les changements s'appliquent en direct, avec annuler / rétablir. Le rendu s'affine quand on s'arrête (anti-crénelage, reflets stables dans les pierres).

### Les pierres : l'Atlas chromatique
Le sélecteur de pierres suit l'*Atlas chromatique des gemmes* : **52 pierres en 7 familles** (rouge, pourpre et rose ; bleu nuit, cyan et aigue-marine ; vert, olive et jade ; jaune, doré et orange ; violet et mauve ; incolore, brun et noir ; polychromes). Chaque pierre a son vrai indice de réfraction et sa vraie dispersion.

![Une pierre centrale en émeraude : familles de l'atlas et recherche](images/03-matieres.jpg)

Une **fiche** accompagne la pierre choisie : espèce, **dureté de Mohs**, indice de réfraction, repère visuel. Sous la dureté 7, un **avertissement** rappelle que la pierre craint les rayures en bague de tous les jours. Les **autres variétés de la même espèce** sont à un clic (le corindon, par exemple : rubis, saphirs de toutes couleurs, padparadscha). Le champ de recherche trouve une pierre par son nom, son espèce ou sa famille.

Les minéraux opaques ont leur **motif propre** : lapis-lazuli (veines blanches et paillettes de pyrite), turquoise (matrice brune), malachite (bandes), œil de tigre (fibres), jade, opale (feux qui changent avec l'angle), labradorite (éclairs bleus et dorés), pierre de lune…

![Lapis-lazuli : fiche, dureté et avertissement](images/03b-pierre-lapis.jpg)

Deux pierres ont un comportement particulier : l'**ametrine** est bicolore (améthyste et citrine dans la même pierre) et l'**alexandrite change de couleur avec l'éclairage**, comme la vraie : verte à la lumière du jour, rouge-violet à la lumière chaude. Changez l'éclairage (bouton soleil) pour la voir basculer.

| Lumière du jour | Coucher de soleil |
|:---:|:---:|
| ![Alexandrite, lumière du jour](images/03c-alexandrite-jour.jpg) | ![Alexandrite, coucher de soleil](images/03d-alexandrite-soir.jpg) |

Le bouton **Client** (en haut à droite) montre la bague exactement comme votre client la verra, écrin d'ouverture compris.

## 3. Les projets
Un **projet** = une bague avec ses matières, sa lumière et sa vignette en vue 3/4. Les projets sont enregistrés dans votre compte et retrouvés sur tous vos appareils.

Le menu en haut à gauche ouvre les quatre pages de votre espace :

![Le menu](images/06-menu.jpg)

- **Nouveau projet** : donnez un nom (facultatif), choisissez ou déposez un fichier 3D ; le projet est créé et enregistré aussitôt.
- **Enregistrer la bague** : enregistre l'état actuel (mise à jour du projet ouvert, ou nouveau projet).

![Créer un nouveau projet](images/05-nouveau-projet.jpg)

La page **Projets** permet de chercher, trier, ouvrir, renommer, dupliquer, archiver, rendre privé (voir §7) ou supprimer. Une suppression peut être **annulée pendant quelques secondes**.

![La page Projets](images/15-projets.jpg)

![Menu d'un projet](images/16-projets-menu.jpg)

## 4. Envoyer une bague à un client
Bouton **Partager** : donnez un nom à votre envoi (visible de vous seul, par exemple « Mme Dupont – alliance »), puis créez le **lien client**. Un lien par envoi : vous saurez exactement qui a regardé quoi.

![Partager : un lien par envoi](images/07-partage.jpg)

Le lien est prêt à copier, à partager, ou à scanner (QR). Le client n'a besoin d'aucun compte.

![Lien client créé, avec son QR](images/08-lien-cree.jpg)

## 5. Ce que voit le client
Le client ouvre le lien : un **écrin** apparaît ; en le touchant, le couvercle se soulève et la bague en sort.

![L'écrin, à l'ouverture du lien](images/09-ecrin-client.jpg)

Il voit la bague configurée, sans réglage ni sélection, peut la faire tourner, **l'essayer sur sa main avec la caméra de son téléphone** (la bague se pose sur le doigt, en tenant compte de l'occlusion) et prendre une photo.

![La vue client](images/10-vue-client.jpg)

Une mention discrète « Mesure d'audience anonyme de ce lien » est visible dès l'ouverture. Le client peut en lire le détail et **refuser la mesure** à tout moment.

![La mention d'information du client](images/11-mesure-anonyme.jpg)

## 6. Suivre ses clients : tableau de bord et liens
Le **tableau de bord** est la page d'accueil du joaillier : chiffres de la semaine (consultations, essayages, temps moyen, avec la variation), **contacts à relancer** (les clients qui ont essayé la bague ou passé du temps dessus), activité récente de l'atelier et projets récents.

![Le tableau de bord](images/14-tableau-de-bord.jpg)

La page **Liens clients** liste tous vos envois, avec leur état et un repère d'**intérêt** (faible, moyen, fort).

![Liste des liens clients](images/17-liens-clients.jpg)

Le détail d'un lien donne : nombre de consultations et d'appareils, temps total et moyen (le temps réellement passé à l'écran), écrin ouvert, essayages sur la main, photos, appareil, historique complet et graphique des 14 derniers jours. Vous pouvez **désactiver / réactiver** le lien (le client voit « ce lien n'est plus disponible »), le **modifier** (nom, note privée, date d'expiration), le **mettre à jour** avec la bague actuelle sans changer l'adresse, ou le **supprimer** avec tout son historique.

![Détail d'un lien](images/18-lien-detail.jpg)

## 7. Travailler à plusieurs : joailliers et droits
Dans **Joailliers**, invitez un collègue : l'application crée un **lien d'invitation à usage unique, valable 7 jours**. La personne l'ouvre, se connecte (ou crée son compte) et rejoint votre atelier. Tout ce qu'elle y enregistre appartient à l'atelier du propriétaire.

![L'invitation, côté invité](images/13-invitation.jpg)

La page liste l'équipe et la **visibilité** de chaque projet : un projet *visible* peut être vu par les invités, un projet *privé* reste pour vous seul.

![La page Joailliers](images/19-joailliers.jpg)

**Cliquez sur une personne** pour régler précisément ce qu'elle peut faire. Les réglages s'enregistrent aussitôt.

- **Projets** : *tous les projets visibles*, ou *sélection uniquement* ; dans les deux cas vous pouvez **accorder un projet précis** à la personne, même s'il est privé.

![Accès aux projets, un par un](images/20-droits-invite.jpg)

- **Fonctionnalités** : créer et modifier des projets, supprimer, **créer des liens clients**, **voir les liens et leurs statistiques**. Par défaut un invité peut voir les projets non privés, les créer et les modifier ; le reste est à vous de l'accorder.

![Fonctionnalités accordées](images/21-droits-fonctionnalites.jpg)

Ces droits sont appliqués **côté serveur** : un invité ne peut pas les contourner. Les liens clients créés par un invité autorisé appartiennent à l'atelier ; sans le droit « voir les liens », il ne voit que les siens, sans statistiques. Vous pouvez retirer un joaillier à tout moment.

Voici ce que voit l'invité (ici, trois projets sur cinq) :

![Vue de l'invité](images/22-vue-invite.jpg)

## 8. Sur téléphone
L'application est conçue d'abord pour le téléphone : le configurateur s'utilise au doigt, et le backoffice passe en **barre de navigation en bas**.

| Configurateur | Tableau de bord | Projets |
|:---:|:---:|:---:|
| ![Configurateur mobile](images/23-mobile-configurateur.jpg) | ![Tableau de bord mobile](images/24-mobile-tableau-de-bord.jpg) | ![Projets mobile](images/25-mobile-projets.jpg) |

## 9. Vie privée
- **Le client** : on enregistre la date, la durée visible, les actions (écrin, essayage, photo), le type d'appareil, le système, le navigateur et la langue. **Jamais** l'adresse IP, la localisation ni l'identité. Conservation 13 mois, puis suppression automatique. Le client peut refuser la mesure.
- **Les fichiers 3D** ne quittent l'appareil que si vous **partagez** un lien client ou **enregistrez** un projet.
- **Le texte d'information** affiché au client est à faire valider par votre conseil juridique (RGPD, ePrivacy) : le joaillier est responsable du traitement.

## 10. Pour les développeurs
- Démarrer, tester, déployer : [README](../README.md). Mise en route Firebase, règles de sécurité, droits, déploiement : [FIREBASE.md](FIREBASE.md). Choix de conception : [DECISIONS.md](../DECISIONS.md). Test sur iPhone : [IOS_TESTS.md](IOS_TESTS.md).
- **Régénérer les captures de ce guide** : `npm run emulators` (autre terminal), puis `npm run guide`. Le script (`scripts/guide.mjs`) réinitialise les émulateurs (jamais la production), crée des comptes fictifs, enregistre des projets, crée des liens clients, simule des consultations, invite un second joaillier, puis photographie chaque écran dans `docs/images/` (JPEG, ≈ 1,7 Mo au total). Aucune donnée réelle n'est utilisée.
- **Version PDF** à transmettre (sans les passages techniques) : `npm run guide:pdf` produit `docs/Guide-Domuse.pdf` (A4, captures incluses ; fichier non versionné, à régénérer).
- Les captures sont **versionnées** (contrairement à `docs/screenshots/` des tests E2E) : relancer le script et les valider à l'œil avant de commiter une évolution visible de l'interface.
