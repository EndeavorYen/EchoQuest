import { FB } from '../gfx/fb';
import { TextLayer, setTextLayer } from '../gfx/text';

export const W = 180;
export const MIN_H = 320;
export const MAX_H = 420;

/**
 * Owns the <canvas>. The game draws into a tiny indexed framebuffer (180 px
 * wide, 320–420 px tall); this scales it up by a whole-number factor so every
 * game pixel is a perfect square on screen, centred with a dark border.
 */
export class Screen {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private small: HTMLCanvasElement;
  private sctx: CanvasRenderingContext2D;
  private img!: ImageData;
  fb: FB;
  readonly text: TextLayer;
  H = MIN_H;
  scale = 1;
  private offX = 0;
  private offY = 0;
  private dpr = 1;
  onResize: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.small = document.createElement('canvas');
    this.sctx = this.small.getContext('2d')!;
    this.fb = new FB(W, MIN_H);
    this.text = new TextLayer(() => document.createElement('canvas'));
    setTextLayer(this.text);
    this.text.target = this.fb;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
  }

  resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const pw = Math.max(1, Math.round(window.innerWidth * this.dpr));
    const ph = Math.max(1, Math.round(window.innerHeight * this.dpr));
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.scale = Math.max(1, Math.min(Math.floor(pw / W), Math.floor(ph / MIN_H)));
    const newH = Math.max(MIN_H, Math.min(MAX_H, Math.floor(ph / this.scale)));
    this.offX = Math.floor((pw - W * this.scale) / 2);
    this.offY = Math.floor((ph - newH * this.scale) / 2);
    if (newH !== this.H || this.fb.w !== W) {
      this.H = newH;
      this.fb = new FB(W, newH);
      this.text.target = this.fb;
    }
    this.small.width = W;
    this.small.height = this.H;
    this.img = this.sctx.createImageData(W, this.H);
    this.onResize?.();
  }

  /** Window (CSS px) → framebuffer coordinates. */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    return {
      x: Math.floor((clientX * this.dpr - this.offX) / this.scale),
      y: Math.floor((clientY * this.dpr - this.offY) / this.scale),
    };
  }

  present(): void {
    this.fb.toRGBA(this.img.data);
    this.sctx.putImageData(this.img, 0, 0);
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#1a1c2c';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.small, this.offX, this.offY, W * this.scale, this.H * this.scale);
    this.text.flush(c, this.offX, this.offY, this.scale);
  }
}
