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
