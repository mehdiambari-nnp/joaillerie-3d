# Checklist de test sur iPhone (Safari et Chrome iOS)
Les tests automatisés tournent en Chromium : tout ce qui suit se vérifie à la main sur l'appareil (site publié, ou `npm run dev` + `?debug` en développement, voir README).

## Joaillier (connecté)
- [ ] Page de connexion plein écran : e-mail et Google ; « Mot de passe oublié » ; pas de défilement horizontal, zones sûres respectées.
- [ ] Ouvrir un fichier 3D depuis Fichiers (⤒) : bague affichée, zones créées, rapport d'import cohérent (pierre centrale, griffes, chaton).
- [ ] Toucher la bague → zone sélectionnée ; double toucher → cadrage ; pincer / tourner fluide (≥ 30 ips). Rendu net à l'arrêt (cumul d'images), sans scintillement.
- [ ] Appliquer une pierre, un métal, une finition ; annuler / rétablir ; fiche récap ; photo.
- [ ] Bouton **Client** : l'écrin s'ouvre comme pour un client ; retour au mode joaillier sans bague décalée.
- [ ] **Menu** : 4 pages (Tableau de bord, Projets, Liens clients, Joailliers), barre du bas lisible (≥ 11 px), retour du navigateur ferme la page ; atelier sélectionnable si on en a rejoint.
- [ ] **Projets** : enregistrer (vignette 3/4 nette), renommer, dupliquer, archiver, supprimer puis « Annuler » dans les 6 s ; recherche.
- [ ] **Partager** : créer un lien client nommé, copier, QR ; il s'ouvre dans un autre navigateur **sans compte**.
- [ ] **Liens clients** : après une ouverture côté client, la consultation apparaît (durée, écrin, essayage, photo) ; désactiver puis rouvrir le lien : message « n'est plus disponible ».
- [ ] **Joailliers** : inviter par lien, fiche d'un invité (projets un par un, interrupteurs de fonctionnalités à ≥ 44 px, sans erreur au toucher).

## Client (lien `#l=`)
- [ ] L'écrin s'ouvre, la bague apparaît ; interface épurée ; mention « Mesure d'audience anonyme… » visible en bas, page « En savoir plus », refus de la mesure.
- [ ] **Essayer** : permission caméra, « Main détectée », bague sur l'annulaire, occlusion par le doigt, réglages Doigt / Taille / Champ de vision / Retourner, photo. Main gauche et droite, paume et dos.
- [ ] Lien désactivé ou supprimé : page d'information, rien d'autre.

## Général
- [ ] Chrome iOS : même parcours (WebKit) ; si caméra refusée : Réglages ▸ Chrome ▸ Caméra.
- [ ] Mémoire : pas de rechargement automatique de l'onglet après plusieurs changements de matière.
- [ ] AR (désactivée dans l'interface, `?flags=ar` ou `features.ar` du thème) : Quick Look s'ouvre, bague à l'échelle réelle.
Noter tout écart et ajouter `?debug` pour la console (développement uniquement).
