# Thèmes clients (marque blanche)

Tout ce qui change d'une joaillerie à l'autre vit dans `themes/<client>/` :

| Fichier | Rôle |
|---|---|
| `theme.json` | nom, description, logo d'en-tête, polices, palettes **claire** et **sombre**, thème par défaut, textes à surcharger (`texts.fr/en`), interrupteurs de fonctionnalités (`features`), nom de l'app installée (`pwa`) |
| `monogram.svg`, `wordmark.svg`, `lockup.svg` | logos vectoriels monochromes (ils prennent la couleur du texte du thème) |
| `icons/icon-{180,192,512}.png` | icônes de l'app (générées : `node scripts/make-icons.mjs <client>`) |

## Nouveau client
1. `cp -r themes/exemple themes/<client>` puis éditer `theme.json` (couleurs, polices, textes) et déposer les logos.
2. Logo en image ? `python3 scripts/trace-logo.py logo.jpg themes/<client>/wordmark.svg` (noir sur blanc → SVG).
3. `node scripts/make-icons.mjs <client>` pour les icônes.
4. Aperçu : `THEME=<client> npm run dev`. Publication : un site Netlify par client avec la variable d'environnement `THEME=<client>`.

Sans logo (`"header": {"logo": "text"}`), le nom de la marque s'affiche en texte. Polices : ajouter le paquet `@fontsource/...` et le lister dans `fonts.packages`.
