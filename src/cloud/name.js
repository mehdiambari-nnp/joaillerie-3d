// Nom affiché d'un joaillier : prénom et nom du profil (saisis à la création ou fournis par Google) ;
// à défaut, déduit de l'adresse e-mail (« mehdi.ambari@… » → « Mehdi Ambari »).
export function displayName(user) {
  if (user?.name) return user.name;
  const email = String(user?.email || '');
  const words = email.split('@')[0].replace(/\d+/g, ' ').split(/[._+\-\s]+/).filter(Boolean);
  return words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ') || email;
}
