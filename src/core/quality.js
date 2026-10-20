// Niveau de qualité de rendu : les effets lourds (profondeur de champ) sont réservés aux ordinateurs ;
// l'iPhone garde un rendu direct pendant le mouvement et ne cumule des images (anti-crénelage, pierres stables) qu'à l'arrêt.
// Surcharge de test : ?fx=off (rendu direct d'origine), ?fx=mobile (profil iPhone sur ordinateur), ?fx=desktop.
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
let forced = '';
try { forced = new URLSearchParams(location.search).get('fx') || ''; } catch { /* hors navigateur */ }

const MOBILE = forced === 'mobile' || (forced !== 'desktop' && /iPhone|iPad|Android/i.test(ua));

export const QUALITY = {
  mobile: MOBILE,
  post: forced !== 'off',          // pipeline d'image (accumulation) ; faux = rendu direct d'origine
  motionPost: !MOBILE,             // pipeline actif aussi pendant le mouvement (anti-crénelage matériel, pas de saut à l'arrêt)
  accumFrames: MOBILE ? 14 : 40,   // images cumulées à l'arrêt (anti-crénelage + stabilité du scintillement des pierres)
  msaa: MOBILE ? 0 : 2,            // anti-crénelage matériel pendant le mouvement
  dof: !MOBILE,
  contactShadow: true,
  maxRtPixels: 5e6,                // plafond de pixels des tampons (mémoire GPU des écrans Retina)
};
