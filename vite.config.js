import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';
import path from 'node:path';

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
  plugins: [testAssets(), ...(command === 'serve' && useHttps ? [basicSsl()] : [])],
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('@mediapipe/tasks-vision')) return 'mediapipe';
        },
      },
    },
  },
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node', testTimeout: 60000 },
}));
