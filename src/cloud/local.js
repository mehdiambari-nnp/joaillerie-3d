// Service « local » (sans Firebase) : modèles via l'API /api/models (middleware de dev Vite), projets dans IndexedDB.
// Pas de comptes. Sert au développement hors ligne et aux tests (`--mode offline`).
import { uploadModel, downloadModel } from '../share/remote.js';
import { saveProject, listProjects, getProject, deleteProject } from '../projects/projects.js';

const api = async (id, init) => { const r = await fetch(`/api/shares/${id}`, init); if (!r.ok) throw new Error(`partage (${r.status})`); return r.json(); };

export function create() {
  const user = { local: true };
  return {
    kind: 'local',
    auth: { enabled: false, user, onChange(cb) { cb(user); return () => {}; } },
    models: { upload: (m, o) => uploadModel(m, o), download: (id, o) => downloadModel(id, o) },
    shares: {
      put: (id, json) => api(id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ p: json }) }),
      get: async (id) => (await api(id)).p,
    },
    projects: { list: listProjects, get: getProject, save: saveProject, remove: deleteProject },
  };
}
