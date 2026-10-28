import { Screen } from './screen';
import type { FB } from '../gfx/fb';
import { Fx } from '../gfx/fx';
import { UI } from '../gfx/ui';
import { Recognizer } from '../speech/recognizer';
import { sfx } from '../audio/sfx';
import { startCamera, CameraFailure, type CameraHandle } from '../gfx/camera';
import { load, persist, type Save } from '../game/save';
import type { Player } from '../game/model';
import { Rng } from '../util/rng';

export interface Scene {
  /** stable name (class names are minified in production); used by the end-to-end tests */
  readonly id?: string;
  enter?(): void;
  leave?(): void;
  update(dt: number): void;
  draw(): void;
  /** called for every key press (typing fallback) */
  key?(e: KeyboardEvent): void;
}

export type CameraState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

export class App {
  readonly screen: Screen;
  readonly ui = new UI();
  readonly fx = new Fx();
  readonly rec = new Recognizer();
  readonly rng = new Rng(Date.now() & 0x7fffffff);
  save: Save = load();
  /** seconds since start */
  t = 0;
  scene: Scene | null = null;
  cam: CameraHandle | null = null;
  camState: CameraState = 'off';

  constructor(canvas: HTMLCanvasElement) {
    this.screen = new Screen(canvas);
    sfx.enabled = this.save.sound;
    sfx.musicOn = this.save.music;
  }

  get fb(): FB {
    return this.screen.fb;
  }
  get W(): number {
    return this.screen.fb.w;
  }
  get H(): number {
    return this.screen.fb.h;
  }

  get active(): Player {
    return this.save.players[Math.min(this.save.active, this.save.players.length - 1)];
  }

  go(next: Scene): void {
    this.rec.cancel();
    this.scene?.leave?.();
    this.scene = next;
    next.enter?.();
  }

  persist(): void {
    persist(this.save);
  }

  setSound(on: boolean): void {
    this.save = { ...this.save, sound: on };
    sfx.enabled = on;
    this.persist();
  }

  setMusic(on: boolean): void {
    this.save = { ...this.save, music: on };
    sfx.musicOn = on;
    this.persist();
  }

  /** Ask for the camera. Call from a tap so mobile browsers show the permission prompt. */
  async openCamera(): Promise<void> {
    if (this.cam || this.camState === 'starting') return;
    this.camState = 'starting';
    try {
      this.cam = await startCamera();
      this.camState = 'on';
    } catch (err) {
      this.cam = null;
      this.camState = err instanceof CameraFailure && err.code === 'denied' ? 'denied' : 'unavailable';
    }
  }

  closeCamera(): void {
    this.cam?.stop();
    this.cam = null;
    if (this.camState === 'on') this.camState = 'off';
  }
}
