import betterCssModules from '@better-css-modules/vite';
import { fmt, react as reactLint, test, TEST_GLOBS } from '@k8o/oxc-config';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [react(), betterCssModules()],
  // @k8ordo/ui の CSS はこのブラウザ向けに書かれている。Vite 既定の target だと
  // Lightning CSS が入れ子を平らにし、:dir() を dir に従わない :lang() に書き換える
  build: { cssTarget: ['chrome146', 'edge146', 'firefox151', 'safari26'] },
  fmt,
  lint: {
    extends: [reactLint],
    options: {
      reportUnusedDisableDirectives: 'error',
    },
    settings: {
      react: { version: '19.3.1' },
    },
    overrides: [{ files: [...TEST_GLOBS], ...test }],
  },
  staged: {
    '*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc}': 'vp check --fix',
  },
});
