// Fonction Netlify : héberge les modèles partagés et les liens courts dans Netlify Blobs (voir netlify/lib/api.mjs).
import { getStore } from '@netlify/blobs';
import { handleApi } from '../lib/api.mjs';

export default async (req) => handleApi(req, getStore({ name: 'models', consistency: 'strong' }));

export const config = { path: ['/api/models/*', '/api/shares/*'] };
