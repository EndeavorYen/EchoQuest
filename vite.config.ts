import { defineConfig } from 'vitest/config';

// Relative base so the build works both at the root and under /EchoQuest/ on GitHub Pages.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
