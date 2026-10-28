import { quantizeRGBA, analyzeScene, type SceneAnalysis } from './scene';
import type { FB } from './fb';

export interface CameraHandle {
  video: HTMLVideoElement;
  stream: MediaStream;
  mirrored: boolean;
  stop(): void;
}

export type CameraError = 'unsupported' | 'denied' | 'unavailable';

export class CameraFailure extends Error {
  constructor(public code: CameraError, message: string) {
    super(message);
  }
}

/** Ask for the back camera; falls back to whatever camera there is. */
export async function startCamera(): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraFailure('unsupported', 'camera API missing');
  }
  let stream: MediaStream;
  let mirrored = false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (err) {
    const name = (err as DOMException)?.name ?? '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new CameraFailure('denied', 'camera permission denied');
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      mirrored = true;
    } catch (err2) {
      const n2 = (err2 as DOMException)?.name ?? '';
      throw new CameraFailure(n2 === 'NotAllowedError' ? 'denied' : 'unavailable', 'camera unavailable');
    }
  }
  const track = stream.getVideoTracks()[0];
  const facing = track?.getSettings?.().facingMode;
  if (facing === 'user') mirrored = true;

  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  return {
    video,
    stream,
    mirrored,
    stop() {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}

export interface Grab {
  fb: FB;
  analysis: SceneAnalysis;
}

let scratch: HTMLCanvasElement | null = null;

/** Grab the current video frame cropped to w×h ("cover"), quantised to the palette. */
export function grabFrame(cam: CameraHandle, w: number, h: number, analyze: boolean): Grab | null {
  const v = cam.video;
  if (v.readyState < 2 || !v.videoWidth) return null;
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  const va = v.videoWidth / v.videoHeight;
  const ta = w / h;
  let sx = 0;
  let sy = 0;
  let sw = v.videoWidth;
  let sh = v.videoHeight;
  if (va > ta) {
    sw = v.videoHeight * ta;
    sx = (v.videoWidth - sw) / 2;
  } else {
    sh = v.videoWidth / ta;
    sy = (v.videoHeight - sh) / 2;
  }
  ctx.save();
  if (cam.mirrored) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);
  ctx.restore();
  const data = ctx.getImageData(0, 0, w, h).data;
  return {
    fb: quantizeRGBA(data, w, h),
    analysis: analyze ? analyzeScene(data, w, h) : ({ weights: {}, brightness: 0, saturation: 0, detail: 0, hash: 0 } as unknown as SceneAnalysis),
  };
}
