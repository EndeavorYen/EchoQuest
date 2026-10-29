import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Relative base so the build works both at the root and under /EchoQuest/ on GitHub Pages.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), classic: fileURLToPath(new URL('./classic.html', import.meta.url)) } },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
