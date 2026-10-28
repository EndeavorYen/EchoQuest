import { defineConfig } from 'vitest/config';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every CJK character used anywhere in the source, so the font shards for them can be preloaded. */
function collectCjk(dir: string, out: Set<string>): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collectCjk(p, out);
    else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) {
      for (const ch of readFileSync(p, 'utf8')) {
        if (/[　-〿㐀-鿿＀-￯ -⁯…“”]/.test(ch)) out.add(ch);
      }
    }
  }
}

const chars = new Set<string>();
collectCjk('src', chars);

// Relative base so the build works both at the root and under /EchoQuest/ on GitHub Pages.
export default defineConfig({
  base: './',
  define: { __CJK__: JSON.stringify([...chars].join('')) },
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
