// Interrupteurs de fonctionnalités (feature flags). Le code reste en place : passer à `true` pour réactiver.
import theme from 'virtual:theme';
export const FEATURES = {
  autoRotate: false, // rotation automatique de la bague (modes Client et Joaillier)
  viewAngles: false, // choix de l'angle de vue (dessus, 3/4, face…)
  lighting: false,   // gestion des lumières / environnements
};
// Le thème client peut forcer des valeurs (theme.features).
Object.assign(FEATURES, theme.features || {});
