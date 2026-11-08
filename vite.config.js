import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        commons: resolve(import.meta.dirname, 'index.html'),
        spacedynamics: resolve(import.meta.dirname, 'spacedynamics.html')
      }
    }
  }
});
