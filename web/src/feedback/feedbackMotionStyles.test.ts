import fs from 'fs';
import path from 'path';

describe('feedback motion styles', () => {
  it('disables relay feedback motion for reduced-motion users', () => {
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
    const reducedMotionBlock = indexHtml.slice(indexHtml.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(indexHtml).toContain(".eq-relay-world[data-complete='true']");
    expect(reducedMotionBlock).toContain('*, *::before, *::after');
    expect(reducedMotionBlock).toContain('animation-duration: .01ms !important;');
    expect(reducedMotionBlock).toContain('transition-duration: .01ms !important;');
  });
});
