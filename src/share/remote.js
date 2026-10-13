// Hébergement du modèle d'un lien de partage : le fichier du joaillier est déposé sur le serveur (adressé par son empreinte),
// le lien client le recharge. Compression gzip si disponible, découpage en morceaux (limite des fonctions ~6 Mo).
const CHUNK = 4 * 1024 * 1024;
const BASE = '/api/models';

const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Identifiant du modèle : 32 premiers caractères hexadécimaux du SHA-256 du fichier. */
export async function modelId(buffer) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  return hex(h.slice(0, 16));
}

async function pipe(buffer, stream) {
  return new Response(new Blob([buffer]).stream().pipeThrough(stream)).arrayBuffer();
}
const gzip = async (b) => (typeof CompressionStream === 'undefined' ? null : pipe(b, new CompressionStream('gzip')));
const gunzip = (b) => pipe(b, new DecompressionStream('gzip'));

async function ok(r, what) { if (!r.ok) throw new Error(`${what} (${r.status})`); return r; }

/** Dépose le modèle s'il n'est pas déjà hébergé. @returns {Promise<string>} identifiant */
export async function uploadModel({ buffer, name, options = {} }, { onProgress = () => {}, fetchImpl = fetch, base = BASE } = {}) {
  const id = await modelId(buffer);
  const head = await fetchImpl(`${base}/${id}`);
  if (head.ok) return id; // déjà là (même fichier)
  let data = await gzip(buffer), gz = true;
  if (!data) { data = buffer; gz = false; }
  const parts = Math.ceil(data.byteLength / CHUNK);
  for (let i = 0; i < parts; i++) {
    await ok(await fetchImpl(`${base}/${id}/${i}`, { method: 'PUT', body: data.slice(i * CHUNK, (i + 1) * CHUNK), headers: { 'content-type': 'application/octet-stream' } }), 'Envoi du modèle');
    onProgress((i + 1) / (parts + 1));
  }
  await ok(await fetchImpl(`${base}/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, opts: options, gz, parts, size: buffer.byteLength }) }), 'Validation du modèle');
  onProgress(1);
  return id;
}

/** Télécharge un modèle hébergé. @returns {Promise<{buffer: ArrayBuffer, name: string, options: object}>} */
export async function downloadModel(id, { onProgress = () => {}, fetchImpl = fetch, base = BASE } = {}) {
  const meta = await (await ok(await fetchImpl(`${base}/${id}`), 'Modèle introuvable')).json();
  const chunks = [];
  for (let i = 0; i < meta.parts; i++) {
    chunks.push(new Uint8Array(await (await ok(await fetchImpl(`${base}/${id}/${i}`), 'Téléchargement du modèle')).arrayBuffer()));
    onProgress((i + 1) / meta.parts);
  }
  let buffer = await new Blob(chunks).arrayBuffer();
  if (meta.gz) buffer = await gunzip(buffer);
  return { buffer, name: meta.name, options: meta.opts || {} };
}
