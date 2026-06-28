import fs from 'fs';
import path from 'path';

describe('feedback motion styles', () => {
  it('disables event-driven feedback animation for reduced-motion users', () => {
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
    const reducedMotionBlock = indexHtml.slice(indexHtml.indexOf('@media (prefers-reduced-motion: reduce)'));

    expect(reducedMotionBlock).toContain('.eq-word-stage--feedback-success');
    expect(reducedMotionBlock).toContain('.eq-word-stage--feedback-caution');
    expect(reducedMotionBlock).toContain('.eq-word-stage--feedback-celebration');
    expect(reducedMotionBlock).toContain('.eq-word-stage--feedback-voice');
    expect(reducedMotionBlock).toContain('.eq-enemy-figure--feedback-success');
    expect(reducedMotionBlock).toContain('.eq-enemy-figure--feedback-caution');
    expect(reducedMotionBlock).toContain('.eq-enemy-figure--feedback-celebration');
    expect(reducedMotionBlock).toContain('animation: none !important;');
  });
});
