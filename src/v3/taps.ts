/**
 * Small children double-tap. When the screen (or a panel) changes under the finger, the second tap
 * lands on whatever is now there: the battle's microphone, the map, the next service button. Taps that
 * *start* within a short window after a change are dropped. Keyboard activation is never affected.
 */
let changedAt = -Infinity;
let window_ = 0;

/** Call right after the content under the finger changed. */
export function holdTaps(ms = 320): void {
  changedAt = performance.now();
  window_ = ms;
}

/** Automated browsers (the test suite) click immediately after a change on purpose; they opt in with `__tapGuard`. */
function active(): boolean {
  const w = globalThis as { __tapGuard?: boolean; navigator?: Navigator };
  return !w.navigator?.webdriver || !!w.__tapGuard;
}

export function installTapGuard(root: HTMLElement): void {
  let downAt = -Infinity;
  root.addEventListener('pointerdown', () => { downAt = performance.now(); }, { capture: true });
  root.addEventListener(
    'click',
    (e) => {
      if (!active()) return;
      const fresh = downAt >= changedAt && downAt - changedAt < window_;
      if (fresh && (e as MouseEvent).detail > 0) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    { capture: true },
  );
}
