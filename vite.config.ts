import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.config';

const target = (process.env['TARGET'] ?? 'chrome') as 'chrome' | 'firefox';

export default defineConfig(() => ({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@config': resolve(__dirname, 'src/config'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  build: {
    target: 'es2022',
    outDir: `dist/${target}`,
    emptyOutDir: true,
    sourcemap: true,
  },
  plugins: [crx({ manifest, browser: target })],
}));
