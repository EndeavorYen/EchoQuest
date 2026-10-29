/**
 * The phone's vibration, behind one switch. Where there is none (an iPhone's browser, a desktop)
 * every call is quietly ignored, so nothing depends on it.
 */
export const haptics = {
  enabled: true,
  get supported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  },
  pulse(pattern: number | number[]): void {
    if (!this.enabled || !this.supported) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // a blocked or unsupported call must never get in the way of playing
    }
  },
};
