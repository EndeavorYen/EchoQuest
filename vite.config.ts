import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Relative base so the build works both at the root and under /EchoQuest/ on GitHub Pages.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), battle: resolve(__dirname, 'battle.html') } },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
