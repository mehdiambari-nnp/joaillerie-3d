// Projets du joaillier : enregistrés sur l'appareil (IndexedDB) avec le fichier du modèle, la configuration et une vignette.
// Deux magasins : « projects » (léger, pour la liste) et « buffers » (le fichier, lu seulement à l'ouverture).
const DB = 'domuse', VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('stockage indisponible'));
    const rq = indexedDB.open(DB, VERSION);
    rq.onupgradeneeded = () => { const db = rq.result; db.createObjectStore('projects', { keyPath: 'id' }); db.createObjectStore('buffers'); };
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
    rq.onblocked = () => reject(new Error('stockage bloqué'));
  });
}
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error); });
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/** Crée ou met à jour un projet. `meta` : { id, name, modelName, modelId, options, config, env, envRot, thumb } ; `buffer` : fichier du modèle. */
export async function saveProject(meta, buffer) {
  const db = await open();
  try {
    const tx = db.transaction(['projects', 'buffers'], 'readwrite');
    const old = await req(tx.objectStore('projects').get(meta.id));
    tx.objectStore('projects').put({ ...meta, created: old?.created ?? Date.now(), updated: Date.now() });
    if (buffer) tx.objectStore('buffers').put(buffer, meta.id);
    await done(tx);
  } finally { db.close(); }
  return meta.id;
}

/** Modifie le nom ou l'archivage d'un projet (sans le fichier ni la date de modification). */
export async function updateProject(id, patch) {
  const db = await open();
  try {
    const tx = db.transaction('projects', 'readwrite'), st = tx.objectStore('projects'), cur = await req(st.get(id));
    if (cur) st.put({ ...cur, ...Object.fromEntries(Object.entries(patch).filter(([k]) => ['name', 'archived'].includes(k))) });
    await done(tx);
  } finally { db.close(); }
}

/** Copie un projet (fichier compris). */
export async function duplicateProject(id, name) {
  const db = await open();
  try {
    const tx = db.transaction(['projects', 'buffers'], 'readwrite');
    const [meta, buf] = await Promise.all([req(tx.objectStore('projects').get(id)), req(tx.objectStore('buffers').get(id))]);
    if (!meta) throw new Error('projet introuvable');
    const nid = newId(), now = Date.now();
    tx.objectStore('projects').put({ ...meta, id: nid, name: name || meta.name, created: now, updated: now, archived: false });
    if (buf) tx.objectStore('buffers').put(buf.slice ? buf.slice(0) : buf, nid);
    await done(tx);
    return nid;
  } finally { db.close(); }
}

/** Projets, du plus récent au plus ancien (sans les fichiers). */
export async function listProjects() {
  const db = await open();
  try { return (await req(db.transaction('projects').objectStore('projects').getAll())).sort((a, b) => b.updated - a.updated); }
  finally { db.close(); }
}

export async function getProject(id) {
  const db = await open();
  try {
    const tx = db.transaction(['projects', 'buffers']);
    const [meta, buffer] = await Promise.all([req(tx.objectStore('projects').get(id)), req(tx.objectStore('buffers').get(id))]);
    return meta && buffer ? { meta, buffer } : null;
  } finally { db.close(); }
}

export async function deleteProject(id) {
  const db = await open();
  try { const tx = db.transaction(['projects', 'buffers'], 'readwrite'); tx.objectStore('projects').delete(id); tx.objectStore('buffers').delete(id); await done(tx); }
  finally { db.close(); }
}

/** Vignette JPEG réduite (data URL) à partir d'une image PNG. 560 px de large : net sur les cartes (≈ 300 px CSS) des écrans Retina, ~30–50 Ko. */
export async function thumbnail(blob, width = 560) {
  const bmp = await createImageBitmap(blob);
  const w = Math.min(width, bmp.width), h = Math.round((w * bmp.height) / bmp.width);
  // réduction en deux temps (moitié, puis taille finale) : un seul grand saut donne une image crénelée
  let src = bmp, sw = bmp.width, sh = bmp.height;
  const step = (tw, th) => { const k = document.createElement('canvas'); k.width = tw; k.height = th; const g = k.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.fillStyle = '#e9e0d0'; g.fillRect(0, 0, tw, th); g.drawImage(src, 0, 0, sw, sh, 0, 0, tw, th); src = k; sw = tw; sh = th; return k; };
  while (sw / 2 > w) step(Math.round(sw / 2), Math.round(sh / 2));
  const c = step(w, h);
  bmp.close?.();
  return c.toDataURL('image/jpeg', 0.86);
}
