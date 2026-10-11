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
