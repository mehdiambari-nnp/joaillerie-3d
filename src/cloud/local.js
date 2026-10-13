// Service « local » (sans Firebase) : modèles via l'API /api/models (fonction Netlify ou middleware de dev), projets dans IndexedDB.
// Pas de comptes. Sert au développement, aux tests et aux déploiements sans configuration Firebase.
import { uploadModel, downloadModel } from '../share/remote.js';
import { saveProject, listProjects, getProject, deleteProject } from '../projects/projects.js';

export function create() {
  const user = { local: true };
  return {
    kind: 'local',
    auth: { enabled: false, user, onChange(cb) { cb(user); return () => {}; } },
    models: { upload: (m, o) => uploadModel(m, o), download: (id, o) => downloadModel(id, o) },
    projects: { list: listProjects, get: getProject, save: saveProject, remove: deleteProject },
  };
}
