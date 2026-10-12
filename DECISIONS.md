# Décisions prises en autonomie (consigne : « ne me pose plus de questions »)
- **Stack** : Vite + JS vanilla, three.js épinglé 0.183.2 (compatibilité model-viewer), versions exactes.
- **Repère** : mm, doigt = +Z, dessus = +Y, origine = centre du doigt (trou mesuré par rayons radiaux + cercle de Kåsa).
- **Zones** = regroupements ; **affectations par pièce** ; sélection par zone (défaut) ou par pièce.
- **Doublons** (Objet_19/20/21 superposés dans la maquette) supprimés à l'import, signalés dans le rapport.
- **Pierres** : normales plates (facettes), matériau physique (transmission, ior ≤ 2,333, dispersion).
- **iOS** : pas de WebXR → AR = Quick Look (USDZ) ; essayage = caméra + MediaPipe + three.js dans la page ; HTTPS requis pour la caméra.
- **Fichier** : détection du format par l'en-tête (iOS ignore `.fbx`), pas de `accept`.
- **Partage** : lien `#c=` (lz-string), sans serveur ; projet GLB avec config dans `extras`.
- **Essayage** : pose depuis les landmarks monde ; occluder cylindrique ; vidéo en fond de scène pour réfraction des pierres ; filtre One Euro ; LOD 25 %.
- **Diamètre intérieur de la maquette** : 19,49 mm (taille FR 61) — l'estimation initiale du brief (18 mm) était fausse, corrigée.
- **Bug corrigé** : import GLB asynchrone (`parseAsync`) ; mise en page iPhone élargie par les rangées défilantes.

## Itération 2 : qualité graphique + calage de l'essayage
- **Environnements HDRI** (Poly Haven, CC0 : venice-sunset, quarry, overpass, spruit-sunrise, dans `public/hdr/`) en plus des 3 studios procéduraux ; rotation, exposition, fond 360° visible (option « Environnement ») avec flou réglable. Chargement asynchrone + cache, repli sur fond clair en cas d'échec.
- **Fond toujours défini** (dégradé dithéré ou env) : les pierres en transmission réfractent `scene.background`, un fond transparent les rendait pâles.
- **Pierres incolores** : léger « sparkle » (metalness 0,15, envMapIntensity 2,2), épaisseur 6 mm. Haute résolution (DPR jusqu'à 3) après 400 ms d'inactivité.
- **Essayage : cause du mauvais placement** : les world landmarks MediaPipe ne sont pas métriques (paume ≈ 0,73×, doigts compressés). Nouvelle méthode : échelle = taille de la paume dans l'image / moyennes anthropométriques (médiane de 5 segments), relief = world landmarks normalisés à l'échelle image, dessus de la bague toujours vers la caméra (l'étiquette gauche/droite ne distingue pas dos/paume). Validé sur 2 photos réelles (`tests/fixtures/`, `docs/tryon-calibration/`).

## Itération 3 : retours client (matériaux, plein écran, mode client)
- **Plein écran** : la grille de l'app gardait une ligne vide quand la barre du haut était masquée (la vue 3D ne s'agrandissait pas) et il n'y avait aucun moyen de sortir sur iPhone (pas d'Échap). Désormais : vue 3D seule + bouton « Quitter le plein écran » toujours visible.
- **Métaux** : or jaune, rose, rouge, gris, platine (plus blanc que l'or gris), sans titrage. Finitions : poli, satiné, brossé, martelé. « Teinte libre » (couleur + code + teinte/intensité/clarté).
- **Pierres** : diamant seul pour l'incolore (moissanite/CZ identiques à l'écran, supprimés) ; ensuite des pastilles de COULEUR groupées par famille (rouges, roses, orange/jaune, verts, bleu-vert, bleus, violets, noir/nacre), sans noms d'espèces ; teinte libre. La couleur choisie devient la couleur d'atténuation de la pierre (Beer-Lambert).
- **Pantone** : la bibliothèque Pantone est propriétaire (licence payante) → remplacée par un sélecteur libre (code hex, teinte/intensité/clarté). Un import de nuancier (RAL/Pantone fourni par le client) est possible plus tard.
- **Modes** : Client (épuré : vue 3D, rotation, plein écran, AR, essayage, photo ; aucune sélection ni réglage), Joaillier (configuration), Atelier (zones/règles). Le « lien client » (`k:1` dans le lien) verrouille l'interface en mode client.
- **Compatibilité** : anciens identifiants (gold18, sapphire…) convertis automatiquement dans les liens et projets existants.
- **Limite connue** : un lien ne transporte que la configuration, pas le fichier 3D. Pour un modèle propre au joaillier (FBX), le client doit pouvoir le charger : prochaine étape = « Publier » (hébergement du modèle côté Netlify) pour obtenir un lien client court.

## Itération 4 : passe « chic » Domuse
- **Identité** : nom Domuse (logo au trait + wordmark Cormorant Garamond espacé), palette pierre / lilas gris / or sourd, mode sombre bleu-nuit (inspiré du compte Instagram de la joaillerie : fonds gris doux, pierres profondes). Polices embarquées via @fontsource (pas de requête externe).
- **Interface** : icônes au trait à la place des emojis, boutons fins, bouton principal encre, intitulés en petites capitales espacées, mode client sans barre : logo centré + trois actions.
- **Rendu** : éclairage par défaut = HDRI « Ville, plein soleil » (le studio s'affiche le temps du chargement) ; fond de scène gris pierre. Brossé : relief très léger pour éviter l'effet quadrillé en gros plan.

## Itération 5 — feuille repliable, liste des parties, vue éclatée

- **Feuille inférieure en accordéons exclusifs** (Parties / Matière / Teinte libre) : repliés par défaut, la vue 3D garde l'essentiel de l'écran ; animation `grid-template-rows` 0fr→1fr. Palettes en grille (plus de lignes tronquées).
- **Liste des parties à choix multiples** : lignes sobres (nom en serif, pastille matière, coche), outils « tout / aucune / similaires ».
- **Vue éclatée** (`src/core/explode.js`) : décalage radial par zone depuis l'origine du modèle, easeInOutCubic 900 ms avec léger décalage entre pièces, recul caméra automatique. Bouton global + bouton par partie. Les exports (GLB/AR/USDZ) et l'essayage remettent toujours la bague assemblée.
- **Éclatement** : le « haut » est déduit des pierres/sertissage ; le corps (rôle `body`) descend à l'opposé, le reste monte radialement.
- **Œil par partie** : masque/affiche une partie (réutilise `app.hidden`, annulable, conservé dans les liens de partage).
- **Correctif** : masquer/afficher une partie recalcule l'éclatement ; les positions d'origine sont désormais remesurées à l'état assemblé (avant, la bague restait éclatée). Test : `scripts/explode-regression.mjs`.
- **Mode Atelier retiré** (modes restants : Client / Joaillier). **Plein écran** masqué en mode client. **Thème clair/sombre** : palette ivoire-champagne-bronze (clair) et noir chaud-or (sombre), bouton lune/soleil dans la colonne d'outils, choix mémorisé, sinon réglage du système.
- Éclatement : les animations en cours ne sont plus annulées quand on masque/affiche une partie (cause probable du bug « reste éclaté » si on enchaîne vite).
- Bandeau d'aide et infos taille/diamètre retirés de la vue 3D (restent dans les exports).
- **Sélection pièce par pièce** : chaque partie à plusieurs pièces se déplie (chevron) en sous-lignes Pierre 1, 2… avec coche et œil. Bouton clair/sombre déplacé dans la barre du haut, à gauche du sélecteur Client / Joaillier.
- **Clic sur la bague** : 1er clic = toute la partie (ex. toutes les pierres latérales) ; clic suivant dans une partie déjà sélectionnée = ajoute/retire la pierre visée.

## Flux de déploiement (économie de crédits Netlify)
- Un déploiement en **production** (push/fusion sur `main`) coûte 15 crédits ; les **Deploy Previews / déploiements de branche** coûtent 0.
- Travail sur la branche `dev` + pull request vers `main` : chaque push génère un aperçu gratuit. On ne fusionne dans `main` que sur validation (« on publie »).

## Itération 6
- **Feature flags** (`src/config/features.js`) : rotation automatique, choix de l'angle de vue et gestion des lumières sont désactivés (boutons masqués, rotation coupée en Client et Joaillier) ; le code reste, il suffit de passer le flag à `true`.
- **Pastilles de couleur des pierres** : petites gemmes facettées (SVG généré, `src/materials/gemicon.js`) à la place des ronds — palette, en-têtes d'accordéon et liste des parties.
- **Rendu (PBR)** : MeshPhysicalMaterial (métal metalness 1, pierres en transmission/IOR/dispersion) + éclairage par image HDRI (IBL). Le HDRI « Ville, plein soleil » reçoit une balance des blancs chaude pour l'éclairage seulement (le fond reste fidèle) : l'or est moins verdâtre quand il reflète le ciel bleu.
- **Barre d'outils de vue** : explosion + plein écran en ligne en bas à droite ; libellé « Quitter le plein écran » supprimé (le bouton plein écran devient l'icône « réduire » en mode plein écran).
- **Clic 3D sur une pierre** : 1er clic = toute la partie ; 2e clic (partie entière sélectionnée) = isole la pierre touchée ; clics suivants = ajoute / retire la pierre touchée.

## Itération 7 — rendu physique des pierres et des métaux
- **Cause du rendu « plat » vs concurrent** : surtout l'éclairage (HDRI de ciel sans sources franches) et la transmission écran de three.js, qui ne sait pas faire de réflexions internes. Le HDRI n'était qu'en partie fautif.
- **Pierres = ray tracing intérieur** (`src/materials/gem.js`) : pour chaque pierre, une cube-map des normales de facettes et des distances est rendue une fois depuis son centre. Le shader (greffé sur MeshPhysicalMaterial) suit le rayon : réfraction (Snell), jusqu'à 6 rebonds internes (4 sur mobile), réflexion totale interne, Fresnel, dispersion sur 3 indices (R/G/B), absorption Beer–Lambert pour la couleur. Normales plates par facette.
- **Valeurs physiques** : IOR diamant 2,42 (borné à 2,6), rubis/saphir 1,77, émeraude 1,58… ; dispersion diamant 0,044 (écart B–R), amplifiée ×1,5 pour le rendu temps réel.
- **Éclairage** : HDRI « Ville » à balance chaude + softboxes procédurales (haut chaud, bandes latérales chaude/froide, fond) composées dans la scène PMREM → reflets doux et contrastés sur l'or, comme en studio.
- **Limites connues** : non testé sur iPhone réel (coût : 3 traces × rebonds par pixel de pierre) ; l'export GLB/AR utilise les matériaux de substitution (le shader n'est pas exportable) ; légère scintillation sur les diamants.

## Itération 8 — marque blanche (thèmes clients)
- **Un dossier par client** (`themes/<client>/theme.json` + logos + icônes). Le thème est choisi **au build** (`THEME=<client>`, défaut `domuse`) : un site Netlify par client, aucune identité d'un client dans le bundle d'un autre.
- Mise en œuvre : plugin Vite `config/vite-theme.js` (module virtuel `virtual:theme`, `<title>`/meta, manifest et icônes générés) ; `src/config/theme.js` injecte palettes clair/sombre + polices en variables CSS ; textes surchargeables par thème ; flags de fonctionnalités surchargeables.
- Charte Domuse : bordeaux `#31161f`, beige `#e5e1c8`, gris-bleu `#7d8e98`, papier Arena `#f0ece9` ; Inter seule (la typo des intitulés « Couleurs / Papiers » est écartée) ; clair = beige, sombre = bordeaux. Logos vectorisés (potrace) depuis les JPG fournis (`scripts/trace-logo.py`) : à remplacer par les fichiers d'origine si disponibles.
- Cormorant Garamond retiré ; `public/manifest.webmanifest` et `public/icons` remplacés par la génération depuis le thème. `themes/exemple` : thème de démonstration sans logo (repli texte).

## Itération 9 — zoom automatique sur la sélection
- Sélectionner une partie (clic 3D ou liste) cadre la caméra dessus ; pour des pierres, la vue passe de face (depuis l'extérieur de la bague) afin de bien voir couleur et facettes. Vider la sélection revient au cadrage d'ensemble en gardant l'angle courant. Pas de rezoom en changeant de pierre dans la même partie. Désactivable : flag `autoZoomSelect` (`src/config/features.js`, surchargeable par thème).
