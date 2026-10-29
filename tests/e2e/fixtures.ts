import { test as base, expect, type Page } from '@playwright/test';

/** A fake browser speech engine: tests queue what the "player" says. '!denied' simulates a blocked mic. */
const FAKE_SPEECH = `
(() => {
  window.__voice = { queue: [], starts: 0 };
  class FakeRec {
    constructor() { this.onstart = this.onaudiostart = this.onresult = this.onerror = this.onend = null; this.live = false; }
    start() {
      window.__voice.starts += 1;
      this.live = true;
      setTimeout(() => {
        if (!this.live) return;
        this.onstart && this.onstart();
        this.onaudiostart && this.onaudiostart();
        const v = window.__voice.queue.shift();
        setTimeout(() => {
          if (!this.live) return;
          if (v === undefined) { this.onerror && this.onerror({ error: 'no-speech' }); this.onend && this.onend(); return; }
          if (v === '!denied') { this.onerror && this.onerror({ error: 'not-allowed' }); this.onend && this.onend(); return; }
          const alts = Array.isArray(v) ? v : [v];
          const res = { isFinal: true, length: alts.length };
          alts.forEach((t, i) => { res[i] = { transcript: t }; });
          this.onresult && this.onresult({ results: [res], resultIndex: 0 });
          this.onend && this.onend();
        }, 80);
      }, 40);
    }
    stop() {}
    abort() { this.live = false; }
  }
  window.SpeechRecognition = FakeRec;
  window.webkitSpeechRecognition = FakeRec;
})();
`;

export interface Zone { x: number; y: number; w: number; h: number; label?: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
export class Game {
  constructor(readonly page: Page) {}

  async open(url = '/classic.html?debug'): Promise<void> {
    await this.page.goto(url);
    await this.page.waitForFunction(() => (window as any).__eq?.scene);
    await this.frames(3);
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.page.waitForFunction(() => (window as any).__eq?.scene);
    await this.frames(3);
  }

  frames(n = 2): Promise<void> {
    return this.page.evaluate(
      (k) => new Promise<void>((res) => {
        let i = 0;
        const step = () => (++i >= k ? res() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
      n,
    );
  }

  /** Query anything about the running game. */
  eval<T>(fn: (app: any) => T): Promise<T> {
    return this.page.evaluate(`(${fn.toString()})(window.__eq)`) as Promise<T>;
  }

  scene(): Promise<string> {
    return this.eval((a) => a.scene?.id ?? '?');
  }

  zones(): Promise<Zone[]> {
    return this.eval((a) => a.ui.list());
  }

  async has(label: string): Promise<boolean> {
    return (await this.zones()).some((z) => z.label === label);
  }

  /** Wait until a tappable zone with this label is on screen. */
  async waitFor(label: string, timeout = 15_000): Promise<void> {
    await expect.poll(() => this.has(label), { timeout, message: `waiting for "${label}"` }).toBe(true);
  }

  async waitScene(id: string, timeout = 15_000): Promise<void> {
    await expect.poll(() => this.scene(), { timeout, message: `waiting for scene ${id}` }).toBe(id);
  }

  /** Tap a labelled zone with a real pointer press, exactly as a finger would. */
  async tap(label: string, nth = 0): Promise<void> {
    await this.waitFor(label);
    const pt = await this.page.evaluate(
      ({ label, nth }) => {
        const a = (window as any).__eq;
        const zs = a.ui.list().filter((z: any) => z.label === label);
        const z = zs[nth];
        if (!z) return null;
        return a.screen.toClient(z.x + z.w / 2, z.y + z.h / 2);
      },
      { label, nth },
    );
    if (!pt) throw new Error(`no zone "${label}"`);
    await this.page.mouse.click(pt.x, pt.y);
    await this.frames(2);
  }

  say(...phrases: Array<string | string[]>): Promise<void> {
    return this.page.evaluate((p) => { (window as any).__voice.queue.push(...p); }, phrases);
  }

  save(): Promise<any> {
    return this.eval((a) => JSON.parse(JSON.stringify(a.save)));
  }

  /** The active battle scene's state (private fields are still readable at runtime). */
  battle(): Promise<{ phase: string; hp: number; maxHp: number; combo: number; turn: number; word: string | null; defWord: string | null; attacker: string; defender: string; tries: number; mode: string; boss: boolean }> {
    return this.eval((a) => {
      const s = a.scene;
      return {
        phase: s.phase,
        hp: s.b.monster.hp,
        maxHp: s.b.monster.maxHp,
        combo: s.b.combo,
        turn: s.b.turn,
        word: s.sel ? s.sel.word.w : null,
        defWord: s.defWord ? s.defWord.w : null,
        attacker: s.b.attacker.name,
        defender: s.b.defender.name,
        tries: s.tries,
        mode: s.speaker.mode,
        boss: s.b.monster.boss,
      };
    });
  }

  waitPhase(phase: string, timeout = 20_000): Promise<void> {
    return expect.poll(async () => (await this.battle()).phase, { timeout, message: `waiting for battle phase ${phase}` }).toBe(phase);
  }

  /** Title → map → "find a monster" → summon (no camera) → fight. Leaves you in the battle's speak phase, with a word already dealt. */
  async startBattle(opts: { boss?: boolean } = {}): Promise<void> {
    if ((await this.scene()) === 'title') await this.tap(await this.has('CONTINUE') ? 'CONTINUE' : 'START');
    await this.waitScene('map');
    await this.tap('node');
    await this.waitScene('scan');
    await this.tap('NO CAMERA');
    await this.waitFor('FIGHT!');
    await this.tap('FIGHT!');
    await this.waitScene('battle');
    await this.waitPhase('speak');
    void opts;
  }

  async setMonsterHp(hp: number): Promise<void> {
    await this.page.evaluate((h) => { (window as any).__eq.scene.b.monster.hp = h; }, hp);
  }

  /** Jump the trek to a given stop (then reload so every screen sees it). */
  async jumpToNode(idx: number): Promise<void> {
    await this.page.evaluate((i) => {
      const a = (window as any).__eq;
      if (!a.save.run) throw new Error('no run');
      a.save = { ...a.save, run: { ...a.save.run, idx: i } };
      a.persist();
    }, idx);
    await this.reload();
  }

  async newGameToMap(): Promise<void> {
    await this.open();
    await this.tap('START');
    await this.waitScene('map');
  }

  /** Tap a player's avatar chip to hand them the turn. */
  async switchTo(index: number): Promise<void> {
    await this.tap('player', index);
  }

  /** One attacker turn: the word is already dealt; say it (or whatever `says` returns). */
  async cast(says?: (word: string) => string | string[]): Promise<void> {
    await this.waitPhase('speak');
    const b = await this.battle();
    await this.say(says ? says(b.word!) : b.word!);
    await this.tap('mic');
  }

  /** One shield turn. */
  async shield(says?: (word: string) => string | string[]): Promise<void> {
    await this.waitPhase('defend');
    const b = await this.battle();
    await this.say(says ? says(b.defWord!) : b.defWord!);
    await this.tap('mic');
  }

  /** Wait for the game to react to an answer: the phase moves on, or a retry is consumed. */
  async settle(from: { phase: string; tries: number }): Promise<void> {
    await expect
      .poll(async () => {
        const b = await this.battle();
        return b.phase !== from.phase || b.tries !== from.tries;
      }, { timeout: 15_000, message: 'waiting for the answer to be processed' })
      .toBe(true);
  }

  /** Get the current word wrong until the game lets it go (three chances). */
  async failWord(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      const from = await this.battle();
      if (from.phase !== 'speak' && from.phase !== 'defend') return;
      await this.say('zzzz');
      await this.tap('mic');
      await this.settle(from);
    }
  }

  /** Play the whole battle with perfect answers until the victory panel. */
  async winBattle(): Promise<void> {
    for (let i = 0; i < 80; i++) {
      const b = await this.battle();
      if (b.phase === 'victory') return;
      if (b.phase === 'speak') {
        await this.say(b.word!);
        await this.tap('mic');
        await this.settle(b);
      } else if (b.phase === 'defend') {
        await this.say(b.defWord!);
        await this.tap('mic');
        await this.settle(b);
      } else await this.page.waitForTimeout(120);
    }
    throw new Error('battle did not finish');
  }
}

export const test = base.extend<{ game: Game; errors: string[] }>({
  errors: async ({ page }, use) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(`console.error: ${m.text()}`);
    });
    await use(errs);
    expect(errs, 'no runtime errors').toEqual([]);
  },
  game: async ({ page, errors }, use) => {
    void errors;
    await page.addInitScript(FAKE_SPEECH);
    await use(new Game(page));
  },
});

export { expect };
