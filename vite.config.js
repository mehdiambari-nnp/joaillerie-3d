import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';
import path from 'node:path';
import themePlugin from './config/vite-theme.js';
import { handleApi, memoryStore } from './dev/local-api.mjs';

// Dev / preview local : API d'hébergement locale (mode `offline`, tests) avec un stockage en mémoire.
const modelsApi = () => {
  const store = memoryStore();
  const mw = async (req, res, next) => {
    if (!req.url.startsWith('/api/models') && !req.url.startsWith('/api/shares')) return next();
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const r = await handleApi(new Request('http://localhost' + req.url, { method: req.method, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), store);
    res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await r.arrayBuffer()));
  };
  return { name: 'models-api', configureServer(s) { s.middlewares.use(mw); }, configurePreviewServer(s) { s.middlewares.use(mw); } };
};

// En dev uniquement : sert assets/test/* sous /test-assets (le FBX de test n'est JAMAIS copié dans le build publié).
const testAssets = () => ({
  name: 'test-assets',
  configureServer(server) {
    server.middlewares.use('/test-assets', (req, res, next) => {
      const f = path.resolve('assets/test', decodeURIComponent((req.url || '/').slice(1).split('?')[0]));
      if (!f.startsWith(path.resolve('assets/test')) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return next();
      res.setHeader('Content-Type', 'application/octet-stream');
      fs.createReadStream(f).pipe(res);
    });
  },
});

// HTTPS en dev : obligatoire pour la caméra (essayage) et l'AR sur iPhone. E2E=1 → HTTP (tests Playwright).
const useHttps = !process.env.E2E;
export default defineConfig(({ command }) => ({
  base: './',
  plugins: [themePlugin(), testAssets(), modelsApi(), ...(command === 'serve' && useHttps ? [basicSsl()] : [])],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          // (MediaPipe : pas de chunk manuel — rangé avec l'essayage, il emportait l'assistant d'import dynamique et se chargeait partout)
        },
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node', testTimeout: 60000 },
}));
