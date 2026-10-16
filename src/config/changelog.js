// Journal des nouveautés. Le plus récent en premier ; la première entrée = version courante de l'application.
// À chaque nouvelle version : ajouter une entrée ici (la fenêtre « Nouveautés » s'affiche une fois par visiteur).
export const CHANGELOG = [
  {
    version: '0.9.1', date: '2026-10-16',
    fr: [
      'Pierres opaques et translucides (rhodochrosite, jade, lapis, malachite, turquoise, onyx, perle…) : rendu en cabochon poli, avec reflets doux et chair translucide',
      'Reflets plus réalistes : chaque minéral a sa propre brillance (veines mates, paillettes brillantes, éclat soyeux ou gras) et le bord des pierres serties est légèrement assombri sous le serti',
      'Rhodochrosite refaite d’après une pierre réelle : rose-corail, nuages et voiles laiteux',
      'Œil de tigre refait d’après des pierres réelles : larges bandes brunes et dorées, fibres soyeuses, reflet lumineux (chatoyance) qui glisse quand on tourne la pierre',
    ],
    en: [
      'Opaque and translucent stones (rhodochrosite, jade, lapis, malachite, turquoise, onyx, pearl…): polished cabochon rendering with soft reflections and translucent flesh',
      'More realistic reflections: each mineral has its own gloss (matte veins, bright flecks, silky or waxy sheen) and the edge of set stones is slightly darkened under the setting',
      'Rhodochrosite redone from a real stone: coral pink, clouds and milky veils',
      'Tiger’s eye redone from real stones: broad brown and gold bands, silky fibres, a bright chatoyant line that glides as you turn the stone',
    ],
  },
  {
    version: '0.9.0', date: '2026-10-16',
    fr: [
      'Sélecteur de pierres refait d’après l’Atlas chromatique des gemmes : 7 familles de couleur et plus de 50 pierres',
      'Nouvelles pierres : spinelle, rubellite, topaze, tanzanite, tsavorite, jade, malachite, lapis-lazuli, turquoise, œil de tigre, opale, labradorite, pierre de lune…',
      'Alexandrite : elle change de couleur avec l’éclairage ; ametrine bicolore',
      'Fiche de chaque pierre : espèce, dureté, indice de réfraction, avertissement pour les pierres tendres, autres variétés de la même espèce ; recherche par nom',
    ],
    en: [
      'Stone picker rebuilt from the Gem Colour Atlas: 7 colour families and over 50 stones',
      'New stones: spinel, rubellite, topaz, tanzanite, tsavorite, jade, malachite, lapis lazuli, turquoise, tiger’s eye, opal, labradorite, moonstone…',
      'Alexandrite changes colour with the lighting; bicolour ametrine',
      'Stone card: species, hardness, refractive index, warning for soft stones, other varieties of the same species; search by name',
    ],
  },
  {
    version: '0.8.2', date: '2026-10-16',
    fr: [
      'Les droits d’un joaillier invité se mettent à jour sans avoir à recharger la page',
      'Tableau de bord sur téléphone : boutons d’action alignés',
    ],
    en: [
      'A guest jeweler’s rights now update without reloading the page',
      'Dashboard on phones: aligned action buttons',
    ],
  },
  {
    version: '0.8.1', date: '2026-10-16',
    fr: [
      'Nouveau bouton « Nouveau projet » : donnez un nom, choisissez ou déposez un fichier 3D, le projet est créé et enregistré',
    ],
    en: [
      'New “New project” button: give it a name, choose or drop a 3D file, the project is created and saved',
    ],
  },
  {
    version: '0.8.0', date: '2026-10-16',
    fr: [
      'Droits des joailliers invités : cliquez sur un joaillier pour lui donner accès aux projets un par un, ou à tous',
      'Vous choisissez ses fonctionnalités : créer et modifier, supprimer, créer des liens clients, voir les liens et leurs statistiques',
      'Les liens clients créés par un invité appartiennent à votre atelier',
    ],
    en: [
      'Guest jeweler rights: click a jeweler to give access to projects one by one, or to all of them',
      'You choose their features: create and edit, delete, create client links, see links and their statistics',
      'Client links created by a guest belong to your workshop',
    ],
  },
  {
    version: '0.7.1', date: '2026-10-16',
    fr: [
      'Vignettes des projets et des liens beaucoup plus nettes (enregistrez de nouveau un projet pour renouveler sa vignette)',
      'Pages du backoffice avec leur propre adresse ; suppressions annulables',
    ],
    en: [
      'Much sharper project and link thumbnails (save a project again to refresh its thumbnail)',
      'Back-office pages have their own address; deletions can be undone',
    ],
  },
  {
    version: '0.7.0', date: '2026-10-16',
    fr: [
      'Menu repensé : plus de textes d’explication, chaque entrée ouvre sa propre page',
      'Nouveau tableau de bord : indicateurs de la semaine, contacts à relancer, activité récente, projets récents',
      'Page Projets : recherche, archivage, duplication, renommage ; page Joailliers : invitations et projets visibles ou privés pour chaque invité',
    ],
    en: [
      'Redesigned menu: no more explanatory text, each entry opens its own page',
      'New dashboard: weekly figures, leads to follow up, recent activity, recent projects',
      'Projects page: search, archive, duplicate, rename; Jewelers page: invitations and visible or private projects for each guest',
    ],
  },
  {
    version: '0.6.0', date: '2026-10-16',
    fr: [
      'Liens clients suivis : un lien par envoi, avec un nom pour vous repérer',
      'Nouveau backoffice « Liens clients » : consultations, temps passé, essayages, photos, appareil, historique',
      'Désactivez, réactivez, modifiez ou supprimez un lien à tout moment ; mettez-le à jour avec la bague actuelle',
    ],
    en: [
      'Tracked client links: one link per recipient, with a name to find it again',
      'New “Client links” back office: views, time spent, try-ons, photos, device, history',
      'Disable, re-enable, edit or delete a link at any time; update it with the current ring',
    ],
  },
  {
    version: '0.5.1', date: '2026-10-16',
    fr: [
      'Bouton « Client » : l’écrin s’ouvre comme pour votre client, pour juger son expérience complète',
      'Les vignettes des projets enregistrés sont toujours en vue 3/4, quel que soit l’angle de la caméra',
    ],
    en: [
      'Client button: the box opens just as it does for your client, so you can judge the full experience',
      'Saved-project thumbnails are always a 3/4 view, whatever the camera angle',
    ],
  },
  {
    version: '0.5.0', date: '2026-10-15',
    fr: [
      'Rendu plus net et plus stable : images cumulées à l’arrêt (arêtes fines lissées, éclats des pierres sans scintillement)',
      'Ombre de contact réaliste sous la bague',
      'Flou de profondeur en gros plan, avec mise au point progressive (ordinateur)',
      'Pierres de couleur : zonation et inclusions discrètes',
    ],
    en: [
      'Sharper, steadier rendering: frames accumulate when still (fine edges smoothed, no more gem flicker)',
      'Realistic contact shadow under the ring',
      'Depth of field in close-ups, with progressive focus (desktop)',
      'Coloured stones: subtle zoning and inclusions',
    ],
  },
  {
    version: '0.4.0', date: '2026-10-12',
    fr: [
      'Le bouton de finition devient un curseur : glissez dessus pour régler l’effet',
      'Satiné : degré de satinage ; Brossé : orientation du brossage ; Martelé : taille des coups de marteau',
      'Finitions refaites d’après des pièces réelles : satiné lisse, brossé fin, martelé en petites cuvettes',
      'La réalité augmentée est désactivée pour l’instant',
    ],
    en: [
      'The finish button is now a slider: drag across it to tune the effect',
      'Satin: satin level; Brushed: brushing direction; Hammered: hammer-mark size',
      'Finishes rebuilt from real pieces: smooth satin, fine brushed, small-dimple hammered',
      'Augmented reality is switched off for now',
    ],
  },
  {
    version: '0.3.1', date: '2026-10-12',
    fr: [
      'Finitions de l’or retravaillées d’après des pièces réelles : satiné doux sans rayures, brossé mat à grain fin, martelé',
    ],
    en: [
      'Gold finishes reworked from real pieces: streak-free soft satin, matte fine-grain brushed, faceted hammered',
    ],
  },
  {
    version: '0.3.0', date: '2026-10-12',
    fr: [
      'Quatre nuances d’or jaune : intense, classique, clair et champagne',
      'Les pierres portent le nom de la gemme qui a cette couleur (rubis, émeraude, saphir, tanzanite…)',
      'Chaque pierre a ses propriétés optiques réelles : indice de réfraction et dispersion',
      'Sélection dans la vue 3D : un contour net autour de la pièce, sans filtre sur sa couleur',
      'Éclairage revu : fini le gris-vert sur l’or, reflets chauds mis en valeur',
    ],
    en: [
      'Four yellow gold shades: deep, classic, light and champagne',
      'Stones are named after the gem with that colour (ruby, emerald, sapphire, tanzanite…)',
      'Each stone has its real optical properties: refractive index and dispersion',
      '3D selection: a crisp outline around the piece, no colour filter over it',
      'Lighting reworked: no more grey-green cast on gold, warm highlights',
    ],
  },
  {
    version: '0.2.0', date: '2026-10-12',
    fr: [
      'Rendu des pierres refait : réflexions internes, éclat et couleurs plus fidèles',
      'Or et métaux plus chauds, avec des reflets de studio',
      'Zoom automatique sur la pierre ou la partie sélectionnée',
      'Vue éclatée par étages : corps, sertissage, pierres',
      'Nouvelle identité visuelle, thèmes clair et sombre',
    ],
    en: [
      'Gemstone rendering rebuilt: internal reflections, brilliance and truer colours',
      'Warmer gold and metals with studio reflections',
      'Automatic zoom on the selected stone or part',
      'Exploded view in layers: body, setting, stones',
      'New visual identity, light and dark themes',
    ],
  },
  { version: '0.1.0', date: '2026-10-10', fr: ['Première version : import du modèle 3D, matériaux, AR et essayage sur la main'], en: ['First release: 3D model import, materials, AR and hand try-on'] },
];
export const CURRENT_VERSION = CHANGELOG[0].version;

const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

/** Entrées à montrer à un visiteur dont la dernière version vue est `seen` (null = jamais ; on ne montre alors que la plus récente). */
export function unseenEntries(seen) {
  if (seen === CURRENT_VERSION) return [];
  if (!seen) return [CHANGELOG[0]];
  return CHANGELOG.filter((e) => cmp(e.version, seen) > 0);
}
