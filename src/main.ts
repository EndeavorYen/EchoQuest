import './pixel-font.css';
import { App } from './core/app';
import { canvasRasterizer, clearGlyphCache, FONT_FAMILY, setRasterizer } from './gfx/text';
import { sfx } from './audio/sfx';
import { TitleScene } from './scenes/title';

async function loadFont(): Promise<void> {
  const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 …“”';
  try {
    await Promise.race([
      document.fonts.load(`12px ${FONT_FAMILY}`, sample),
      new Promise((r) => setTimeout(r, 6000)),
    ]);
  } catch {
    // fall back to whatever the system has
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('stage') as HTMLCanvasElement;
  await loadFont();
  setRasterizer(canvasRasterizer((w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }));
  clearGlyphCache();

  const app = new App(canvas);
  app.go(new TitleScene(app));
  if (location.search.includes('debug')) (window as unknown as { __eq: App }).__eq = app;

  // taps are dispatched synchronously inside the pointer event: mobile browsers
  // only allow the microphone / audio to start from a real user gesture
  const point = (e: PointerEvent) => app.screen.toLogical(e.clientX, e.clientY);
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = point(e);
    app.ui.px = p.x;
    app.ui.py = p.y;
    app.ui.down = true;
    sfx.unlock();
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = point(e);
    app.ui.px = p.x;
    app.ui.py = p.y;
  });
  const up = (e: PointerEvent, cancel: boolean) => {
    const p = point(e);
    const wasDown = app.ui.down;
    app.ui.down = false;
    app.ui.px = -100;
    app.ui.py = -100;
    if (wasDown && !cancel) app.ui.dispatch(p.x, p.y);
  };
  canvas.addEventListener('pointerup', (e) => up(e, false));
  canvas.addEventListener('pointercancel', (e) => up(e, true));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => app.scene?.key?.(e));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sfx.setMusic(null);
  });

  let last = performance.now();
  const frame = (now: number) => {
    const raw = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dt = app.fx.update(raw);
    app.t += raw;
    app.ui.begin();
    app.scene?.update(dt);
    app.scene?.draw();
    app.screen.present();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void boot();
