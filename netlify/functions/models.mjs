// Fonction Netlify : héberge les modèles partagés dans Netlify Blobs (voir netlify/lib/models-api.mjs).
import { getStore } from '@netlify/blobs';
import { handleModels } from '../lib/models-api.mjs';

export default async (req) => handleModels(req, getStore({ name: 'models', consistency: 'strong' }));

export const config = { path: '/api/models/*' };
