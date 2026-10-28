import type { FB } from './fb';
import { C, type PalIndex } from './palette';
import { drawText } from './text';
import { Rng } from '../util/rng';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; c: PalIndex; size: number; grav: number;
}

interface Floater {
  x: number; y: number; text: string; c: PalIndex; outline: PalIndex;
  life: number; max: number; scale: number; vy: number;
}

interface Ring {
  x: number; y: number; r: number; vr: number; life: number; max: number; c: PalIndex;
}

/** Screen shake, hit-stop, flashes, particles and floating numbers: the "juice". */
export class Fx {
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private rings: Ring[] = [];
  private shakeAmp = 0;
  private shakeT = 0;
  private shakeMax = 0;
  private stopT = 0;
  private flashT = 0;
  private flashMax = 1;
  private flashC: PalIndex = C.snow;
  private rng = new Rng(Date.now() & 0xffff);

  shake(amp: number, dur = 0.25): void {
    if (amp >= this.shakeAmp || this.shakeT <= 0) {
      this.shakeAmp = amp;
      this.shakeT = dur;
      this.shakeMax = dur;
    }
  }

  /** Freeze the game for a few frames on impact. */
  hitstop(seconds: number): void {
    this.stopT = Math.max(this.stopT, seconds);
  }

  flash(c: PalIndex = C.snow, dur = 0.18): void {
    this.flashC = c;
    this.flashT = dur;
    this.flashMax = dur;
  }

  burst(x: number, y: number, n: number, colors: PalIndex[], speed = 60, grav = 90, life = 0.6): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const s = this.rng.range(speed * 0.35, speed);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.25,
        life: life * this.rng.range(0.6, 1.1), max: life, c: this.rng.pick(colors),
        size: this.rng.chance(0.25) ? 2 : 1, grav,
      });
    }
  }

  sparkle(x: number, y: number, w: number, h: number, n: number, colors: PalIndex[]): void {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + this.rng.range(0, w), y: y + this.rng.range(0, h),
        vx: this.rng.range(-4, 4), vy: this.rng.range(-18, -6),
        life: this.rng.range(0.4, 0.9), max: 0.9, c: this.rng.pick(colors), size: 1, grav: -4,
      });
    }
  }

  ring(x: number, y: number, c: PalIndex, speed = 120, life = 0.35): void {
    this.rings.push({ x, y, r: 2, vr: speed, life, max: life, c });
  }

  float(x: number, y: number, text: string, c: PalIndex, scale = 1, outline: PalIndex = C.ink, life = 0.9): void {
    this.floaters.push({ x, y, text, c, outline, life, max: life, scale, vy: -26 });
  }

  /** Advance effects. Returns the dt the game itself should use (0 during hit-stop). */
  update(dt: number): number {
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.9;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      r.r += r.vr * dt;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    if (this.stopT > 0) {
      this.stopT -= dt;
      return 0;
    }
    return dt;
  }

  get offset(): { x: number; y: number } {
    if (this.shakeT <= 0) return { x: 0, y: 0 };
    const k = this.shakeT / this.shakeMax;
    const a = Math.max(1, Math.round(this.shakeAmp * k));
    return { x: this.rng.int(-a, a), y: this.rng.int(-a, a) };
  }

  draw(fb: FB): void {
    for (const r of this.rings) {
      fb.ring(Math.round(r.x), Math.round(r.y), Math.round(r.r), r.c);
    }
    for (const p of this.particles) {
      if (p.life < p.max * 0.25 && (Math.floor(p.life * 40) & 1) === 0) continue;
      fb.rect(Math.round(p.x), Math.round(p.y), p.size, p.size, p.c);
    }
    for (const f of this.floaters) {
      if (f.life < 0.2 && (Math.floor(f.life * 30) & 1) === 0) continue;
      drawText(fb, f.text, Math.round(f.x), Math.round(f.y), f.c, { align: 'center', scale: f.scale, outline: f.outline });
    }
    if (this.flashT > 0) {
      const lvl = Math.round((this.flashT / this.flashMax) * 16);
      fb.veil(0, 0, fb.w, fb.h, this.flashC, lvl);
    }
  }
}
