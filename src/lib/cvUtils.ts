import type { Cv } from '../types/opencv';

/** Upload images are downscaled so the longest edge is at most this many px. */
export const MAX_DIM = 1024;

/**
 * Scope tracks intermediate cv.Mat (and other deletable cv objects) so a
 * processor can free everything with one call. The Emscripten heap is manually
 * managed — every Mat must be .delete()'d or memory leaks.
 *
 *   const s = new Scope();
 *   const gray = s.t(new cv.Mat());   // tracked → auto-freed
 *   const out = new cv.Mat();         // NOT tracked → caller owns it
 *   ...
 *   s.done();                         // frees gray, leaves out alive
 */
export class Scope {
  private items: Array<{ delete: () => void }> = [];
  t<T extends { delete: () => void }>(item: T): T {
    this.items.push(item);
    return item;
  }
  done() {
    for (const item of this.items) {
      try {
        item.delete();
      } catch {
        /* already freed */
      }
    }
    this.items = [];
  }
}

/** Safely delete any cv object, ignoring double-frees. */
export function safeDelete(...objs: Array<{ delete?: () => void } | null | undefined>) {
  for (const o of objs) {
    try {
      o?.delete?.();
    } catch {
      /* noop */
    }
  }
}

/** Load a File (from <input>/drop) into a decoded HTMLImageElement. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像の読み込みに失敗しました。'));
    };
    img.src = url;
  });
}

/** Draw any image source to a (possibly downscaled) canvas, preserving aspect ratio. */
export function sourceToCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  maxDim = MAX_DIM,
): HTMLCanvasElement {
  const sw = 'naturalWidth' in source ? source.naturalWidth || source.width : source.width;
  const sh = 'naturalHeight' in source ? source.naturalHeight || source.height : source.height;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

/** Read a canvas into a cv.Mat (RGBA, 8UC4). Caller owns the returned Mat. */
export function matFromCanvas(cv: Cv, canvas: HTMLCanvasElement) {
  return cv.imread(canvas);
}

/** Render a cv.Mat into a canvas element for display. */
export function showMat(cv: Cv, mat: any, canvas: HTMLCanvasElement) {
  cv.imshow(canvas, mat);
}

/** A grayscale (8UC1) view of an RGBA Mat. Caller must delete the result. */
export function toGray(cv: Cv, rgba: any) {
  const gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  return gray;
}

/** An RGB (8UC3) view of an RGBA Mat. Caller must delete the result. */
export function toRGB(cv: Cv, rgba: any) {
  const rgb = new cv.Mat();
  cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
  return rgb;
}

/** Force an odd integer ≥ 1 (kernel-size constraint helper). */
export function odd(n: number): number {
  const v = Math.max(1, Math.round(n));
  return v % 2 === 0 ? v + 1 : v;
}
