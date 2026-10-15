// Journal des nouveautés. Le plus récent en premier ; la première entrée = version courante de l'application.
// À chaque nouvelle version : ajouter une entrée ici (la fenêtre « Nouveautés » s'affiche une fois par visiteur).
export const CHANGELOG = [
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
