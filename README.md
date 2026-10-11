# Joaillerie 3D — configurateur de bagues

Web app (HTML5 / CSS3 / JS + three.js) : importez un `.fbx` (ou GLB/OBJ), tournez la bague comme sur Sketchfab,
touchez une partie (corps, griffes, chaton, pierres…) et appliquez une matière (or, platine, diamant, émeraude…) en temps réel.
Partage par lien, export GLB/USDZ, **AR Quick Look** (iPhone) et **essayage sur la main** (caméra + MediaPipe).

Tout s'exécute dans le navigateur : le fichier 3D ne quitte jamais l'appareil.

## Démarrer
```bash
npm install            # copie aussi les wasm MediaPipe (postinstall)
npm run dev            # HTTPS auto-signé, accessible sur le réseau local
npm run dev -- --open  # puis ?model=gemv charge assets/test/MAQUETTE_GEMV.fbx
npm test               # 18 tests unitaires
npm run test:e2e       # E2E Chromium headless (captures dans docs/screenshots/)
npm run build          # dist/ statique, à héberger en HTTPS
```

## Tester sur iPhone (voir docs/IOS_TESTS.md)
1. Mac/PC et iPhone sur le même Wi‑Fi, `npm run dev`, ouvrir l'URL « Network » (https://192.168.x.x:5173) dans Safari ou Chrome iOS, accepter le certificat.
2. Ouvrir la maquette : bouton ⤒ (sélecteur de fichiers). Ajouter `?debug` à l'URL pour une console intégrée.
3. « Essayer » → caméra → main ouverte, paume ou dos face à l'iPhone.
4. « AR » → Quick Look (USDZ, échelle réelle).

## Architecture
`src/import` (FBX→modèle normalisé mm, doublons, zones, mesure du doigt) · `src/materials` (bibliothèque, fabrique PBR, miniatures)
· `src/core` (viewer three.js à la demande) · `src/selection` (picking BVH) · `src/app.js` (état, zones, historique)
· `src/state` (partage lz-string) · `src/export` + `src/ar` (GLB/USDZ/Quick Look) · `src/tryon` (MediaPipe, pose, filtre One Euro, occlusion) · `src/ui`.
Repère normalisé : mm, axe du doigt = +Z, dessus (pierres) = +Y. Décisions : `DECISIONS.md`. Brief d'origine : `docs/BRIEF.md`.

## Limites connues (honnêtes)
- **Pas testé sur un vrai iPhone** par moi : tout est validé en Chromium headless (WebGL logiciel, caméra simulée). Voir `docs/IOS_TESTS.md`.
- Non implémentés : rendu HQ lancer de rayons/path tracing, comparateur côte à côte, indicateur de prix, instanciation du pavé, éditeur de matériau libre.
- USDZ : les pierres sont approximées (matériau standard, pas de transmission) — limite d'AR Quick Look. Fichiers AR lourds (GLB ≈ 7 Mo, USDZ ≈ 23 Mo sur la maquette) : décimation à prévoir.
- Essayage : échelle indicative (± quelques %), un seul doigt à la fois, FOV caméra estimé (réglable).
- Le fichier `assets/test/MAQUETTE_GEMV.fbx` est privé : ne pas publier. Voir `assets/LICENSES.md`.

## Crédits
Environnements HDR : [Poly Haven](https://polyhaven.com) (CC0).
