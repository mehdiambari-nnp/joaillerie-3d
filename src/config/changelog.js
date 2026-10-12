// Journal des nouveautés. Le plus récent en premier ; la première entrée = version courante de l'application.
// À chaque nouvelle version : ajouter une entrée ici (la fenêtre « Nouveautés » s'affiche une fois par visiteur).
export const CHANGELOG = [
  {
    version: '0.3.0', date: '2026-10-12',
    fr: [
      'Quatre nuances d’or jaune : intense, classique, clair et champagne',
      'Les pierres portent le nom de la gemme qui a cette couleur (rubis, émeraude, saphir, tanzanite…)',
      'Chaque pierre a ses propriétés optiques réelles : indice de réfraction et dispersion',
    ],
    en: [
      'Four yellow gold shades: deep, classic, light and champagne',
      'Stones are named after the gem with that colour (ruby, emerald, sapphire, tanzanite…)',
      'Each stone has its real optical properties: refractive index and dispersion',
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
