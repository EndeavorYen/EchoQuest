/**
 * Move effects, one look per type (styles come from types.json). Everything is
 * plain DOM + Web Animations inside the arena's `.fx` layer, so it stays crisp
 * on any phone and needs no images.
 */
export interface P { x: number; y: number }

export interface FxHost {
  layer: HTMLElement;
  /** shake the whole arena */
  shake(px: number, ms?: number): void;
  /** a quick wash of colour over the arena */
  flash(color: string, alpha?: number, ms?: number): void;
  /** tint the creature under attack (e.g. frozen) */
  tint(who: 'foe' | 'me', css: string, ms: number): void;
}

type Done = () => void;
const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));
const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

function node(host: FxHost, cls: string, x: number, y: number, color: string, size?: number): HTMLElement {
  const e = document.createElement('div');
  e.className = `pt ${cls}`;
  e.style.cssText = `left:${x}px;top:${y}px;--c:${color}${size ? `;--s:${size}px` : ''}`;
  host.layer.appendChild(e);
  return e;
}

function run(e: HTMLElement, frames: Keyframe[], o: KeyframeAnimationOptions, remove = true): Promise<void> {
  return new Promise((res) => {
    const a = e.animate(frames, { fill: 'forwards', ...o });
    a.onfinish = () => { if (remove) e.remove(); res(); };
    a.oncancel = () => { e.remove(); res(); };
  });
}

/** One particle from a to b along a bowed path. */
function fly(host: FxHost, cls: string, color: string, a: P, b: P, o: { dur: number; delay?: number; bow?: number; size?: number; spin?: number; scale?: [number, number]; ease?: string }): Promise<void> {
  const e = node(host, cls, a.x, a.y, color, o.size);
  const bow = o.bow ?? 0;
  const mx = (b.x - a.x) / 2, my = (b.y - a.y) / 2 - bow;
  const [s0, s1] = o.scale ?? [0.7, 1];
  return run(e, [
    { transform: `translate(0,0) scale(${s0}) rotate(0deg)` },
    { transform: `translate(${mx}px,${my}px) scale(${(s0 + s1) / 2}) rotate(${(o.spin ?? 0) / 2}deg)`, offset: 0.5 },
    { transform: `translate(${b.x - a.x}px,${b.y - a.y}px) scale(${s1}) rotate(${o.spin ?? 0}deg)` },
  ], { duration: o.dur, delay: o.delay ?? 0, easing: o.ease ?? 'ease-in' });
}

function ring(host: FxHost, at: P, color: string, to = 5, ms = 450, delay = 0): Promise<void> {
  const r = node(host, 'ring', at.x, at.y, color);
  return run(r, [{ transform: 'scale(.4)', opacity: 1 }, { transform: `scale(${to})`, opacity: 0 }], { duration: ms, delay, easing: 'ease-out' });
}

function scatter(host: FxHost, at: P, cls: string, colors: string[], n: number, dist: number, ms = 560, size = 12, up = 0): void {
  for (let i = 0; i < n; i++) {
    const p = node(host, cls, at.x, at.y, colors[i % colors.length], size);
    const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
    const d = dist * rnd(0.6, 1.1);
    void run(p, [
      { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d - up}px) scale(.3) rotate(${rnd(-200, 200)}deg)`, opacity: 0 },
    ], { duration: ms, easing: 'ease-out' });
  }
}

const jitter = (p: P, r: number): P => ({ x: p.x + rnd(-r, r), y: p.y + rnd(-r, r) });

type Move = (h: FxHost, c: string[], a: P, b: P, k: number, hit: Done) => void;

const MOVES: Record<string, Move> = {
  /** normal: a spinning star */
  star(h, c, a, b, k, hit) {
    void fly(h, 'sh-star', c[0], a, b, { dur: 420, size: 34 * k, spin: 540, bow: 30 }).then(() => {
      scatter(h, b, 'sh-star', [c[0], '#ffd54a', '#fff'], 7, 60 * k, 520, 14);
      hit();
    });
  },
  /** fire: a fan of fireballs, flames lick upward on impact */
  flame(h, c, a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      const t = { x: b.x + rnd(-22, 22), y: b.y + (i - 2) * 16 };
      ps.push(fly(h, 'sh-fire', i % 2 ? c[1] : c[0], a, t, { dur: 380 + i * 40, delay: i * 55, size: (24 + (i % 2) * 8) * k, bow: (i - 2) * 26, scale: [0.6, 1.2] }));
    }
    void Promise.all(ps).then(() => {
      h.flash(c[0], 0.22, 300);
      scatter(h, b, 'sh-fire', c, 12, 52 * k, 650, 16, 40);
      hit();
    });
  },
  /** water: a spray of droplets, then a big splash */
  jet(h, c, a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 11; i++) ps.push(fly(h, 'sh-drop', i % 3 ? c[0] : c[1], jitter(a, 6), jitter(b, 10), { dur: 330, delay: i * 35, size: (13 + (i % 3) * 4) * k, bow: 40 }));
    void Promise.all(ps).then(() => {
      void ring(h, b, c[0], 6 * k, 520);
      scatter(h, b, 'sh-drop', c, 12, 62 * k, 650, 12, -30);
      hit();
    });
  },
  /** grass: spinning leaves */
  leaf(h, c, a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 7; i++) ps.push(fly(h, 'sh-leaf', i % 2 ? c[1] : c[0], a, jitter(b, 18), { dur: 520, delay: i * 50, size: 24 * k, spin: 540, bow: (i % 2 ? 1 : -1) * rnd(30, 70) }));
    void Promise.all(ps).then(() => {
      scatter(h, b, 'sh-leaf', c, 10, 56 * k, 650, 18);
      hit();
    });
  },
  /** electric: a jagged bolt drawn across the arena, with a white flash */
  bolt(h, c, a, b, k, hit) {
    const svgNs = 'http://www.w3.org/2000/svg';
    const W = h.layer.clientWidth, H = h.layer.clientHeight;
    const pts: string[] = [`${a.x},${a.y}`];
    const n = 7;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    for (let i = 1; i < n; i++) {
      const t = i / n, off = rnd(-26, 26);
      pts.push(`${a.x + dx * t + (-dy / len) * off},${a.y + dy * t + (dx / len) * off}`);
    }
    pts.push(`${b.x},${b.y}`);
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'boltsvg');
    svg.innerHTML = `<polyline points="${pts.join(' ')}" fill="none" stroke="${c[0]}" stroke-width="${12 * k}" stroke-linejoin="round" stroke-linecap="round" opacity=".55"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="#fff" stroke-width="${4 * k}" stroke-linejoin="round" stroke-linecap="round"/>`;
    h.layer.appendChild(svg);
    h.flash('#fff', 0.5, 160);
    void svg.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }, { opacity: 0 }], { duration: 480 }).finished.then(() => svg.remove());
    window.setTimeout(() => {
      scatter(h, b, 'sh-spark', [c[0], '#fff'], 12, 60 * k, 420, 8);
      void ring(h, b, c[0], 5 * k, 380);
      h.shake(6 * k, 260);
      hit();
    }, 150);
  },
  /** bug: a darting swarm */
  swarm(h, c, a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 14; i++) ps.push(fly(h, 'sh-dot', i % 2 ? c[0] : c[1], jitter(a, 12), jitter(b, 20), { dur: rnd(380, 560), delay: rnd(0, 220), size: 11 * k, bow: rnd(-60, 60), spin: 200 }));
    void Promise.all(ps).then(() => {
      scatter(h, b, 'sh-dot', c, 10, 44 * k, 450, 9);
      hit();
    });
  },
  /** poison: floating bubbles that pop */
  bubble(h, c, a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 6; i++) ps.push(fly(h, 'sh-bubble', c[i % 2], jitter(a, 8), jitter(b, 22), { dur: 560, delay: i * 70, size: (20 + i * 3) * k, bow: 50 + i * 6, ease: 'ease-in-out' }));
    void Promise.all(ps).then(() => {
      scatter(h, b, 'sh-bubble', c, 9, 50 * k, 620, 12, -22);
      h.flash(c[0], 0.18, 380);
      hit();
    });
  },
  /** psychic: rings roll across and squeeze the target */
  wave(h, c, a, b, k, hit) {
    for (let i = 0; i < 3; i++) void fly(h, 'ring', c[i % 2], a, b, { dur: 460, delay: i * 130, scale: [0.6, 3.2 * k], ease: 'ease-out' });
    window.setTimeout(() => {
      h.tint('foe', 'hue-rotate(70deg) saturate(2.2) brightness(1.2)', 700);
      for (let i = 0; i < 3; i++) void ring(h, b, c[i % 2], 7 - i, 560, i * 110);
      hit();
    }, 620);
  },
  /** fairy: a trail of twinkling stars */
  charm(h, c, a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 12; i++) ps.push(fly(h, 'sh-sparkle', i % 2 ? c[1] : c[0], jitter(a, 10), jitter(b, 18), { dur: 520, delay: i * 40, size: rnd(16, 28) * k, spin: 360, bow: rnd(-40, 60), ease: 'ease-in-out' }));
    void Promise.all(ps).then(() => {
      h.flash(c[0], 0.25, 420);
      scatter(h, b, 'sh-sparkle', c, 12, 66 * k, 700, 20);
      hit();
    });
  },
  /** ice: shards fly and the target frosts over */
  ice(h, c, a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 6; i++) ps.push(fly(h, 'sh-shard', c[i % 2], a, jitter(b, 22), { dur: 300, delay: i * 45, size: 30 * k, spin: 40, bow: (i - 3) * 8, ease: 'ease-out' }));
    void Promise.all(ps).then(() => {
      h.tint('foe', 'hue-rotate(160deg) brightness(1.35) saturate(.7)', 800);
      h.flash(c[0], 0.3, 350);
      scatter(h, b, 'sh-shard', c, 10, 66 * k, 650, 20);
      hit();
    });
  },
  /** flying: spinning wind crescents */
  tornado(h, c, a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 3; i++) ps.push(fly(h, 'sh-wind', i % 2 ? c[1] : c[0], a, b, { dur: 440, delay: i * 110, size: 42 * k, spin: 720, bow: (i - 1) * 40, scale: [0.6, 1.3] }));
    void Promise.all(ps).then(() => {
      void ring(h, b, c[1], 6 * k, 500);
      scatter(h, b, 'sh-wind', c, 6, 56 * k, 520, 22);
      hit();
    });
  },
  /** ground / rock: boulders rain on the target */
  boulder(h, c, _a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 4; i++) {
      const from = { x: b.x + (i - 1.5) * 26, y: -30 };
      const to = { x: from.x, y: b.y + rnd(-14, 14) };
      ps.push(fly(h, 'sh-rock', c[i % 2], from, to, { dur: 360, delay: i * 110, size: (30 + (i % 2) * 8) * k, spin: 120, scale: [1, 1], ease: 'cubic-bezier(.5,0,1,.6)' }).then(() => {
        h.shake(5 * k, 200);
        scatter(h, to, 'sh-dot', [c[1], c[0]], 6, 34 * k, 420, 9, 20);
      }));
    }
    void Promise.all(ps).then(() => { void ring(h, b, c[1], 5 * k, 420); hit(); });
  },
  /** ghost: spooky orbs spiral in */
  wisp(h, c, a, b, k, hit) {
    const ps: Promise<void>[] = [];
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      ps.push(fly(h, 'sh-wisp', c[i % 2], a, b, { dur: 620, delay: i * 90, size: 28 * k, bow: side * (50 + i * 14), spin: side * 360, ease: 'ease-in-out', scale: [0.6, 1.1] }));
    }
    void Promise.all(ps).then(() => {
      h.flash('#2a1a4a', 0.35, 420);
      h.tint('foe', 'brightness(.55) saturate(.6)', 520);
      scatter(h, b, 'sh-wisp', c, 8, 54 * k, 620, 20, 30);
      hit();
    });
  },
  /** dark: a crescent, then two crossing slashes */
  crescent(h, c, a, b, k, hit) {
    void fly(h, 'sh-wind', c[1], a, b, { dur: 340, size: 40 * k, spin: 360, bow: 20 }).then(() => {
      h.flash('#000', 0.35, 360);
      for (const [rot, d] of [[-35, 0], [35, 110]] as const) {
        const s = node(h, 'sh-slash', b.x, b.y, c[1]);
        void run(s, [{ transform: `translate(-50%,-50%) rotate(${rot}deg) scaleX(0)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${rot}deg) scaleX(1)`, opacity: 1, offset: 0.4 }, { transform: `translate(-50%,-50%) rotate(${rot}deg) scaleX(1)`, opacity: 0 }], { duration: 380, delay: d });
      }
      window.setTimeout(() => { h.shake(5 * k, 220); hit(); }, 160);
    });
  },
  /** dragon: two great orbs spiral together */
  twin(h, c, a, b, k, hit) {
    const ps = [-1, 1].map((side, i) => fly(h, 'sh-orb', c[i], a, b, { dur: 520, size: 38 * k, bow: side * 60, spin: side * 300, ease: 'ease-in-out', scale: [0.6, 1.2] }));
    void Promise.all(ps).then(() => {
      h.flash(c[0], 0.3, 420);
      void ring(h, b, c[0], 7 * k, 520);
      void ring(h, b, c[1], 5 * k, 520, 120);
      scatter(h, b, 'sh-orb', c, 10, 62 * k, 600, 14);
      h.shake(7 * k, 300);
      hit();
    });
  },
  /** fighting: a flurry of punches */
  fist(h, c, a, b, k, hit) {
    void fly(h, 'sh-orb', c[0], a, b, { dur: 200, size: 24 * k, ease: 'ease-out' }).then(async () => {
      for (let i = 0; i < 4; i++) {
        const at = jitter(b, 26);
        scatter(h, at, 'sh-star', [c[0], c[1]], 5, 34 * k, 340, 13);
        void ring(h, at, c[1], 3.2, 280);
        h.shake(5 * k, 150);
        await wait(110);
      }
      hit();
    });
  },
  /** steel: it ricochets before it lands */
  ricochet(h, c, a, b, k, hit) {
    const w = h.layer.clientWidth;
    const p1 = { x: w * 0.55, y: Math.min(a.y, b.y) - 40 };
    const p2 = { x: w * 0.42, y: Math.max(a.y, b.y) + 10 };
    void fly(h, 'sh-shard', c[0], a, p1, { dur: 170, size: 26 * k, ease: 'linear' })
      .then(() => { scatter(h, p1, 'sh-spark', ['#fff', c[0]], 6, 24, 260, 7); return fly(h, 'sh-shard', c[0], p1, p2, { dur: 170, size: 26 * k, ease: 'linear' }); })
      .then(() => { scatter(h, p2, 'sh-spark', ['#fff', c[0]], 6, 24, 260, 7); return fly(h, 'sh-shard', '#fff', p2, b, { dur: 160, size: 30 * k, ease: 'linear' }); })
      .then(() => {
        h.flash('#fff', 0.4, 240);
        scatter(h, b, 'sh-spark', ['#fff', c[0], c[1]], 14, 58 * k, 420, 8);
        h.shake(6 * k, 240);
        hit();
      });
  },
};

/** Play a type's move from `a` to `b`. `hit` fires at the moment of impact. power 2 = a perfect cast. */
export function playMove(host: FxHost, style: string, colors: string[], a: P, b: P, power: 1 | 2, hit: Done): void {
  const c = colors.length > 1 ? colors : [colors[0] ?? '#ffc53d', '#ffffff'];
  const k = power === 2 ? 1.35 : 1;
  (MOVES[style] ?? MOVES.star)(host, c, a, b, k, () => {
    if (power === 2) {
      void ring(host, b, c[0], 8, 520);
      host.shake(5, 260);
    }
    hit();
  });
}

/** The bubble a block raises around a partner. */
export function raiseShield(host: FxHost, at: P, color: string): HTMLElement {
  const s = node(host, 'shieldfx', at.x, at.y, color);
  void s.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
  return s;
}

export function dropShield(s: HTMLElement): void {
  void run(s, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
}

/** Sparks where an attack bounced off a shield. */
export function blockSpark(host: FxHost, at: P, color: string): void {
  void ring(host, at, color, 4, 420);
  scatter(host, at, 'sh-spark', [color, '#fff'], 10, 46, 420, 8);
}
