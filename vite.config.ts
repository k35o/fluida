import { fileURLToPath } from 'node:url';

import { fmt, react as reactLint, tailwind, test } from '@k8o/oxc-config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

const globalsCss = fileURLToPath(
  new URL('./src/styles/globals.css', import.meta.url),
);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  fmt,
  lint: {
    extends: [reactLint, tailwind],
    options: {
      reportUnusedDisableDirectives: 'error',
    },
    settings: {
      react: { version: '19.2.6' },
      tailwindcss: {
        entryPoint: [
          {
            files: '**',
            use: globalsCss,
          },
        ],
      },
    },
    overrides: [
      {
        files: ['**/*.test.ts', '**/*.test.tsx'],
        plugins: [...(test.plugins ?? [])],
        rules: test.rules,
      },
    ],
  },
  staged: {
    '*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc}': 'vp check --fix',
  },
  test: {
    globals: true,
  },
});
