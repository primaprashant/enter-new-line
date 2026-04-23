import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// import { crx } from '@crxjs/vite-plugin';
// import manifest from './src/manifest.config';

export default defineConfig(({ mode }) => {
  const target = process.env.TARGET ?? 'web';
  const isTargetedBuild = target === 'chrome' || target === 'firefox';

  return {
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@config': resolve(__dirname, 'src/config'),
        '@styles': resolve(__dirname, 'src/styles'),
      },
    },
    build: {
      target: 'es2022',
      outDir: isTargetedBuild ? `dist/${target}` : 'dist',
      emptyOutDir: mode !== 'development',
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, 'src/shared/index.ts'),
        formats: ['es'],
        fileName: () => 'scaffold.js',
      },
    },
    // plugins: [crx({ manifest })],
  };
});
