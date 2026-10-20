// Tests des règles de sécurité Firestore (émulateur) : `npm run test:rules` (Java requis ; l'émulateur est lancé par la commande).
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/rules/**/*.test.js'], environment: 'node', testTimeout: 30000, hookTimeout: 30000, fileParallelism: false } });
