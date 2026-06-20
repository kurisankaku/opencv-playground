import type { Cv } from '../types/opencv';
import type { ChartData } from './chartTypes';
import { Scope, toGray, toRGB, odd } from './cvUtils';

/**
 * Demo implementation registry.
 *
 * The catalog (opencvDemos.ts) describes all 91 demos as *spec*. This file holds
 * the subset that actually runs in the browser today — each with its live
 * controls and an OpenCV.js processing function. A demo with an entry here is
 * interactive; one without is shown as spec + "近日実装".
 *
 * Memory: every processor frees its intermediates via Scope#done() in `finally`.
 * The returned `output` Mat is NOT tracked — the caller displays then deletes it.
 */

export interface RuntimeParam {
  id: string;
  label: string;
  type: 'slider' | 'select' | 'toggle' | 'points' | 'rect';
  min?: number;
  max?: number;
  step?: number;
  /**
   * slider/select/toggle: a scalar. 'points': an array of [fx,fy] fractions
   * (0..1) of image size, one per handle. 'rect': [fx,fy,fw,fh] fractions.
   * Spatial defaults are fractions so they map onto any image size; DemoRunner
   * converts them to pixel coordinates before passing to the worker.
   */
  default: number | string | boolean | number[] | number[][];
  options?: { label: string; value: string }[];
  hint?: string;
  count?: number; // 'points': how many draggable handles
  pointLabels?: string[]; // 'points': optional per-handle labels
}

export interface InfoItem {
  label: string;
  value: string;
}

export interface RunResult {
  output?: any; // cv.Mat — caller owns + deletes. Optional for chart-only demos.
  chart?: ChartData; // plain JSON — drawn by a chart component on the main thread.
  info?: InfoItem[];
}

export interface DemoExtras {
  srcB?: any; // second input image (RGBA Mat), for two-image demos
  /** Persistent per-demo store for video demos (survives across frames; cv objects auto-freed on reset). */
  state?: Record<string, any>;
  /** True on the first frame after a (re)start — video demos (re)initialize their state. */
  firstFrame?: boolean;
}

export interface DemoImpl {
  defaultSample: string;
  /** Preview kind. 'image' (default) shows the before/after view; 'chart' shows a chart. */
  output?: 'image' | 'chart';
  /** 'video' streams webcam frames through a stateful frame loop instead of a static image. */
  input?: 'video';
  /** Set for two-image demos: the default sample id for the second ("B") image. */
  secondSample?: string;
  params: RuntimeParam[];
  run: (cv: Cv, src: any, p: Record<string, any>, extras?: DemoExtras) => RunResult;
}

const num = (v: any, d: number) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);
const str = (v: any, d: string) => (typeof v === 'string' ? v : d);
const ACCENT = (cv: Cv) => new cv.Scalar(124, 92, 255, 255);
const ACCENT2 = (cv: Cv) => new cv.Scalar(34, 211, 238, 255);
const FAINT = (cv: Cv) => new cv.Scalar(120, 130, 150, 255);

/** Distinct RGB colors for label/component visualization. */
const LABEL_COLORS: [number, number, number][] = [
  [124, 92, 255], [34, 211, 238], [255, 77, 109], [52, 224, 161],
  [245, 165, 36], [155, 89, 182], [46, 204, 113], [241, 196, 15],
  [231, 76, 60], [52, 152, 219], [230, 126, 34], [26, 188, 156],
];

/**
 * Otsu-binarize (inverted, so light-background shapes become white) and extract
 * external contours. The returned MatVector is tracked in `s` — callers must NOT
 * delete it. Shared by every contour-shape demo.
 */
function externalContours(cv: Cv, src: any, s: Scope) {
  const gray = s.t(toGray(cv, src));
  const bin = s.t(new cv.Mat());
  cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  const contours = s.t(new cv.MatVector());
  const hierarchy = s.t(new cv.Mat());
  cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  return { contours, bin };
}

/**
 * Largest foreground contour, robust to background polarity. Picks Otsu
 * threshold direction from the corner (background) brightness so it works on
 * both dark-objects-on-light-bg and light-objects-on-dark-bg, and skips any
 * near-full-image contour (the background frame). Returns the MatVector
 * (tracked in `s`) and the index of the largest object contour (or -1).
 */
function largestContour(cv: Cv, mat: any, s: Scope) {
  const gray = s.t(toGray(cv, mat));
  const d = gray.data;
  const w = gray.cols, h = gray.rows;
  const bgBright = (d[0] + d[w - 1] + d[(h - 1) * w] + d[h * w - 1]) / 4;
  const bin = s.t(new cv.Mat());
  const type = bgBright > 127 ? cv.THRESH_BINARY_INV : cv.THRESH_BINARY;
  cv.threshold(gray, bin, 0, 255, type + cv.THRESH_OTSU);
  const contours = s.t(new cv.MatVector());
  const hierarchy = s.t(new cv.Mat());
  cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const full = w * h * 0.92;
  let best = -1, bestArea = 0;
  for (let i = 0; i < contours.size(); i++) {
    const a = cv.contourArea(contours.get(i));
    if (a > bestArea && a < full) { bestArea = a; best = i; }
  }
  return { contours, best };
}

/** 4 corners of a minAreaRect, computed from center/size/angle (no boxPoints binding needed). */
function rotatedRectPoints(rr: any): { x: number; y: number }[] {
  const cx = rr.center.x, cy = rr.center.y, w = rr.size.width, h = rr.size.height;
  const a = (rr.angle * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  const dx = [-w / 2, w / 2, w / 2, -w / 2];
  const dy = [-h / 2, -h / 2, h / 2, h / 2];
  return dx.map((_, i) => ({
    x: cx + dx[i] * cos - dy[i] * sin,
    y: cy + dx[i] * sin + dy[i] * cos,
  }));
}

/** Order 4 quad points as [top-left, top-right, bottom-right, bottom-left]. */
function orderQuad(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...pts].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]]; // tl, tr, br, bl
}

const dist2 = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Clamp a spatial 'rect' param value ([x,y,w,h] px) to lie within the image. */
function clampRect(rect: any, cols: number, rows: number): [number, number, number, number] {
  const r = Array.isArray(rect) && rect.length === 4 ? rect : [0, 0, cols, rows];
  let x = Math.round(r[0]), y = Math.round(r[1]), w = Math.round(r[2]), h = Math.round(r[3]);
  x = Math.max(0, Math.min(x, cols - 1));
  y = Math.max(0, Math.min(y, rows - 1));
  w = Math.max(1, Math.min(w, cols - x));
  h = Math.max(1, Math.min(h, rows - y));
  return [x, y, w, h];
}

/** Clamp a spatial point ([x,y] px) into the image bounds. */
function clampPoint(pt: any, cols: number, rows: number): [number, number] {
  const x = Math.max(0, Math.min(Math.round(pt?.[0] ?? 0), cols - 1));
  const y = Math.max(0, Math.min(Math.round(pt?.[1] ?? 0), rows - 1));
  return [x, y];
}

/** ORB detect+compute on a gray Mat; returns keypoint pixel coords + descriptor Mat (tracked in s). */
function orbDetect(cv: Cv, gray: any, s: Scope, n = 500) {
  const orb = s.t(new cv.ORB(n));
  const kp = s.t(new cv.KeyPointVector());
  const des = s.t(new cv.Mat());
  const mask = s.t(new cv.Mat());
  orb.detectAndCompute(gray, mask, kp, des);
  const pts: [number, number][] = [];
  for (let i = 0; i < kp.size(); i++) {
    const k = kp.get(i);
    pts.push([k.pt.x, k.pt.y]);
  }
  return { pts, des };
}

/** Brute-force Hamming match, sorted ascending by distance, top n. */
function bfMatchTopN(cv: Cv, desA: any, desB: any, s: Scope, n: number, crossCheck: boolean) {
  const out: { q: number; t: number; d: number }[] = [];
  if (desA.rows === 0 || desB.rows === 0) return out;
  const bf = s.t(new cv.BFMatcher(cv.NORM_HAMMING, crossCheck));
  const matches = s.t(new cv.DMatchVector());
  bf.match(desA, desB, matches);
  for (let i = 0; i < matches.size(); i++) {
    const m = matches.get(i);
    out.push({ q: m.queryIdx, t: m.trainIdx, d: m.distance });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, n);
}

/** Composite two RGB Mats side by side onto a dark canvas; returns the output Mat + B's x-offset. */
function sideBySide(cv: Cv, a: any, b: any) {
  const H = Math.max(a.rows, b.rows);
  const out = new cv.Mat(H, a.cols + b.cols, cv.CV_8UC3, new cv.Scalar(13, 16, 24));
  const sa = new Scope();
  try {
    a.copyTo(sa.t(out.roi(new cv.Rect(0, 0, a.cols, a.rows))));
    b.copyTo(sa.t(out.roi(new cv.Rect(a.cols, 0, b.cols, b.rows))));
  } finally {
    sa.done();
  }
  return { out, offX: a.cols };
}

export const impls: Record<string, DemoImpl> = {
  // ---------------- image-basics ----------------
  'grayscale-conversion': {
    defaultSample: 'scene',
    params: [],
    run: (cv, src) => {
      const out = new cv.Mat();
      cv.cvtColor(src, out, cv.COLOR_RGBA2GRAY);
      return { output: out, info: [{ label: 'チャンネル', value: '4 → 1' }] };
    },
  },

  'image-resize': {
    defaultSample: 'scene',
    params: [
      { id: 'scale', label: '倍率', type: 'slider', min: 0.1, max: 2, step: 0.05, default: 0.4 },
      {
        id: 'interp',
        label: '補間方法',
        type: 'select',
        default: 'area',
        options: [
          { label: '最近傍 (NEAREST)', value: 'nearest' },
          { label: '線形 (LINEAR)', value: 'linear' },
          { label: '面積平均 (AREA)', value: 'area' },
          { label: 'Cubic', value: 'cubic' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const scale = num(p.scale, 0.4);
        const map: Record<string, number> = {
          nearest: cv.INTER_NEAREST,
          linear: cv.INTER_LINEAR,
          area: cv.INTER_AREA,
          cubic: cv.INTER_CUBIC,
        };
        const w = Math.max(1, Math.round(src.cols * scale));
        const h = Math.max(1, Math.round(src.rows * scale));
        const resized = s.t(new cv.Mat());
        cv.resize(src, resized, new cv.Size(w, h), 0, 0, map[str(p.interp, 'area')]);
        // Composite onto a source-sized frame so the size change is actually
        // visible (otherwise the display normalizes every output to fill the box).
        const frame = new cv.Mat(src.rows, src.cols, src.type(), new cv.Scalar(13, 16, 24, 255));
        const offX = Math.round((src.cols - w) / 2);
        const offY = Math.round((src.rows - h) / 2);
        const fx = Math.max(0, offX);
        const fy = Math.max(0, offY);
        const rx = Math.max(0, -offX);
        const ry = Math.max(0, -offY);
        const cw = Math.min(w - rx, src.cols - fx);
        const ch = Math.min(h - ry, src.rows - fy);
        if (cw > 0 && ch > 0) {
          const sRoi = s.t(resized.roi(new cv.Rect(rx, ry, cw, ch)));
          const dRoi = s.t(frame.roi(new cv.Rect(fx, fy, cw, ch)));
          sRoi.copyTo(dRoi);
        }
        return { output: frame, info: [{ label: '出力サイズ', value: `${w} × ${h} px` }] };
      } finally {
        s.done();
      }
    },
  },

  'image-rotate': {
    defaultSample: 'shapes',
    params: [
      { id: 'angle', label: '角度 (°)', type: 'slider', min: -180, max: 180, step: 1, default: 30 },
      { id: 'scale', label: '拡大率', type: 'slider', min: 0.3, max: 2, step: 0.05, default: 1 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const center = new cv.Point(src.cols / 2, src.rows / 2);
        const M = s.t(cv.getRotationMatrix2D(center, num(p.angle, 30), num(p.scale, 1)));
        const out = new cv.Mat();
        cv.warpAffine(
          src,
          out,
          M,
          new cv.Size(src.cols, src.rows),
          cv.INTER_LINEAR,
          cv.BORDER_CONSTANT,
          new cv.Scalar(10, 12, 18, 255),
        );
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'image-flip': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'dir',
        label: '反転方向',
        type: 'select',
        default: 'h',
        options: [
          { label: '左右 (水平)', value: 'h' },
          { label: '上下 (垂直)', value: 'v' },
          { label: '両方', value: 'both' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const code = { h: 1, v: 0, both: -1 }[str(p.dir, 'h')] ?? 1;
      const out = new cv.Mat();
      cv.flip(src, out, code);
      return { output: out };
    },
  },

  'brightness-adjustment': {
    defaultSample: 'dark',
    params: [{ id: 'beta', label: '明るさ (β)', type: 'slider', min: -120, max: 120, step: 1, default: 50 }],
    run: (cv, src, p) => {
      const out = new cv.Mat();
      src.convertTo(out, -1, 1, num(p.beta, 50));
      return { output: out };
    },
  },

  'contrast-adjustment': {
    defaultSample: 'low-contrast',
    params: [{ id: 'alpha', label: 'コントラスト (α)', type: 'slider', min: 0.2, max: 3, step: 0.05, default: 1.8 }],
    run: (cv, src, p) => {
      const out = new cv.Mat();
      src.convertTo(out, -1, num(p.alpha, 1.8), 0);
      return { output: out };
    },
  },

  'channel-split-merge': {
    defaultSample: 'colored-objects',
    params: [
      {
        id: 'channel',
        label: '表示チャンネル',
        type: 'select',
        default: 'r',
        options: [
          { label: 'R (赤)', value: 'r' },
          { label: 'G (緑)', value: 'g' },
          { label: 'B (青)', value: 'b' },
          { label: '元画像', value: 'all' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const ch = str(p.channel, 'r');
      if (ch === 'all') return { output: src.clone() };
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const vec = s.t(new cv.MatVector());
        cv.split(rgb, vec);
        const idx = { r: 0, g: 1, b: 2 }[ch] ?? 0;
        const out = vec.get(idx).clone();
        return { output: out, info: [{ label: '表示', value: `${ch.toUpperCase()} チャンネル (濃淡)` }] };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- color-conversion ----------------
  'sepia-tone': {
    defaultSample: 'scene',
    params: [{ id: 'intensity', label: '強度', type: 'slider', min: 0, max: 1, step: 0.05, default: 1 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const m = s.t(
          cv.matFromArray(3, 3, cv.CV_32F, [
            0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131,
          ]),
        );
        const sep = s.t(new cv.Mat());
        cv.transform(rgb, sep, m);
        const out = new cv.Mat();
        cv.addWeighted(rgb, 1 - num(p.intensity, 1), sep, num(p.intensity, 1), 0, out);
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'rgb-hsv-conversion': {
    defaultSample: 'colored-objects',
    params: [
      {
        id: 'view',
        label: '表示成分',
        type: 'select',
        default: 'hsv',
        options: [
          { label: 'HSV (擬似カラー)', value: 'hsv' },
          { label: 'H (色相)', value: 'h' },
          { label: 'S (彩度)', value: 's' },
          { label: 'V (明度)', value: 'v' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const hsv = s.t(new cv.Mat());
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        const view = str(p.view, 'hsv');
        if (view === 'hsv') return { output: hsv.clone(), info: [{ label: '注意', value: 'H は 0–179' }] };
        const vec = s.t(new cv.MatVector());
        cv.split(hsv, vec);
        const idx = { h: 0, s: 1, v: 2 }[view] ?? 0;
        return { output: vec.get(idx).clone() };
      } finally {
        s.done();
      }
    },
  },

  'color-extraction-inrange': {
    defaultSample: 'colored-objects',
    params: [
      { id: 'hLow', label: '色相 下限 (H)', type: 'slider', min: 0, max: 179, step: 1, default: 0 },
      { id: 'hHigh', label: '色相 上限 (H)', type: 'slider', min: 0, max: 179, step: 1, default: 12 },
      { id: 'sLow', label: '彩度 下限 (S)', type: 'slider', min: 0, max: 255, step: 1, default: 90 },
      { id: 'vLow', label: '明度 下限 (V)', type: 'slider', min: 0, max: 255, step: 1, default: 70 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const hsv = s.t(new cv.Mat());
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        const low = s.t(
          new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [num(p.hLow, 0), num(p.sLow, 90), num(p.vLow, 70), 0]),
        );
        const high = s.t(
          new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [num(p.hHigh, 12), 255, 255, 255]),
        );
        const mask = s.t(new cv.Mat());
        cv.inRange(hsv, low, high, mask);
        const out = new cv.Mat();
        cv.bitwise_and(rgb, rgb, out, mask);
        const hit = cv.countNonZero(mask);
        const total = mask.rows * mask.cols;
        return {
          output: out,
          info: [{ label: '抽出画素', value: `${((hit / total) * 100).toFixed(1)} %` }],
        };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- filtering-denoising ----------------
  'average-blur': {
    defaultSample: 'noisy',
    params: [{ id: 'k', label: 'カーネルサイズ', type: 'slider', min: 1, max: 31, step: 2, default: 5 }],
    run: (cv, src, p) => {
      const out = new cv.Mat();
      const k = odd(num(p.k, 5));
      cv.blur(src, out, new cv.Size(k, k));
      return { output: out };
    },
  },

  'gaussian-blur': {
    defaultSample: 'noisy',
    params: [
      { id: 'k', label: 'カーネルサイズ', type: 'slider', min: 1, max: 31, step: 2, default: 7 },
      { id: 'sigma', label: 'σ (0で自動)', type: 'slider', min: 0, max: 12, step: 0.5, default: 0 },
    ],
    run: (cv, src, p) => {
      const out = new cv.Mat();
      const k = odd(num(p.k, 7));
      cv.GaussianBlur(src, out, new cv.Size(k, k), num(p.sigma, 0));
      return { output: out };
    },
  },

  'median-blur': {
    defaultSample: 'noisy',
    params: [{ id: 'k', label: 'カーネルサイズ', type: 'slider', min: 3, max: 31, step: 2, default: 5 }],
    run: (cv, src, p) => {
      const out = new cv.Mat();
      cv.medianBlur(src, out, odd(num(p.k, 5)));
      return { output: out };
    },
  },

  'bilateral-filter': {
    defaultSample: 'noisy',
    params: [
      { id: 'd', label: '直径 (d)', type: 'slider', min: 1, max: 21, step: 2, default: 9 },
      { id: 'sc', label: '色 σ', type: 'slider', min: 1, max: 200, step: 1, default: 75 },
      { id: 'ss', label: '距離 σ', type: 'slider', min: 1, max: 200, step: 1, default: 75 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const out = new cv.Mat();
        cv.bilateralFilter(rgb, out, num(p.d, 9), num(p.sc, 75), num(p.ss, 75), cv.BORDER_DEFAULT);
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'sharpen-filter': {
    defaultSample: 'scene',
    params: [{ id: 'amount', label: '強さ', type: 'slider', min: 0, max: 3, step: 0.1, default: 1 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const a = num(p.amount, 1);
        const k = s.t(cv.matFromArray(3, 3, cv.CV_32F, [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]));
        const out = new cv.Mat();
        cv.filter2D(src, out, -1, k);
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- thresholding ----------------
  'simple-threshold': {
    defaultSample: 'document',
    params: [
      { id: 'thresh', label: 'しきい値', type: 'slider', min: 0, max: 255, step: 1, default: 127 },
      {
        id: 'type',
        label: '種類',
        type: 'select',
        default: 'binary',
        options: [
          { label: 'BINARY', value: 'binary' },
          { label: 'BINARY_INV', value: 'binary_inv' },
          { label: 'TRUNC', value: 'trunc' },
          { label: 'TOZERO', value: 'tozero' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const map: Record<string, number> = {
          binary: cv.THRESH_BINARY,
          binary_inv: cv.THRESH_BINARY_INV,
          trunc: cv.THRESH_TRUNC,
          tozero: cv.THRESH_TOZERO,
        };
        const out = new cv.Mat();
        cv.threshold(gray, out, num(p.thresh, 127), 255, map[str(p.type, 'binary')]);
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'otsu-threshold': {
    defaultSample: 'document',
    params: [],
    run: (cv, src) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const out = new cv.Mat();
        const t = cv.threshold(gray, out, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        return { output: out, info: [{ label: '自動しきい値', value: `${Math.round(t)}` }] };
      } finally {
        s.done();
      }
    },
  },

  'adaptive-threshold': {
    defaultSample: 'document',
    params: [
      { id: 'block', label: 'ブロックサイズ', type: 'slider', min: 3, max: 51, step: 2, default: 15 },
      { id: 'C', label: '定数 C', type: 'slider', min: -20, max: 20, step: 1, default: 5 },
      {
        id: 'method',
        label: '手法',
        type: 'select',
        default: 'gaussian',
        options: [
          { label: 'GAUSSIAN', value: 'gaussian' },
          { label: 'MEAN', value: 'mean' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const method =
          str(p.method, 'gaussian') === 'mean'
            ? cv.ADAPTIVE_THRESH_MEAN_C
            : cv.ADAPTIVE_THRESH_GAUSSIAN_C;
        const out = new cv.Mat();
        cv.adaptiveThreshold(gray, out, 255, method, cv.THRESH_BINARY, odd(num(p.block, 15)), num(p.C, 5));
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- morphology ----------------
  ...morph('erosion', 'shapes'),
  ...morph('dilation', 'shapes'),
  ...morph('opening', 'shapes'),
  ...morph('closing', 'shapes'),

  // ---------------- edge-gradient ----------------
  'canny-edge-detection': {
    defaultSample: 'coins',
    params: [
      { id: 't1', label: '下限しきい値', type: 'slider', min: 0, max: 255, step: 1, default: 50 },
      { id: 't2', label: '上限しきい値', type: 'slider', min: 0, max: 255, step: 1, default: 150 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const blur = s.t(new cv.Mat());
        cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0);
        const out = new cv.Mat();
        cv.Canny(blur, out, num(p.t1, 50), num(p.t2, 150), 3, false);
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'sobel-derivative': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'dir',
        label: '方向',
        type: 'select',
        default: 'mag',
        options: [
          { label: 'X 方向', value: 'x' },
          { label: 'Y 方向', value: 'y' },
          { label: '合成 (大きさ)', value: 'mag' },
        ],
      },
      { id: 'k', label: 'カーネルサイズ', type: 'select', default: '3', options: [
        { label: '3', value: '3' },
        { label: '5', value: '5' },
      ] },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const k = Number(str(p.k, '3'));
        const dir = str(p.dir, 'mag');
        const out = new cv.Mat();
        if (dir === 'mag') {
          const gx = s.t(new cv.Mat());
          const gy = s.t(new cv.Mat());
          cv.Sobel(gray, gx, cv.CV_16S, 1, 0, k);
          cv.Sobel(gray, gy, cv.CV_16S, 0, 1, k);
          const ax = s.t(new cv.Mat());
          const ay = s.t(new cv.Mat());
          cv.convertScaleAbs(gx, ax);
          cv.convertScaleAbs(gy, ay);
          cv.addWeighted(ax, 0.5, ay, 0.5, 0, out);
        } else {
          const g = s.t(new cv.Mat());
          cv.Sobel(gray, g, cv.CV_16S, dir === 'x' ? 1 : 0, dir === 'x' ? 0 : 1, k);
          cv.convertScaleAbs(g, out);
        }
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  laplacian: {
    defaultSample: 'shapes',
    params: [{ id: 'k', label: 'カーネルサイズ', type: 'select', default: '3', options: [
      { label: '1', value: '1' },
      { label: '3', value: '3' },
      { label: '5', value: '5' },
    ] }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const lap = s.t(new cv.Mat());
        cv.Laplacian(gray, lap, cv.CV_16S, Number(str(p.k, '3')));
        const out = new cv.Mat();
        cv.convertScaleAbs(lap, out);
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- contours-shape ----------------
  'find-contours': {
    defaultSample: 'shapes',
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 200 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        const contours = s.t(new cv.MatVector());
        const hierarchy = s.t(new cv.Mat());
        cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        const out = src.clone();
        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
          if (cv.contourArea(contours.get(i)) < num(p.minArea, 200)) continue;
          cv.drawContours(out, contours, i, ACCENT(cv), 3);
          count++;
        }
        return { output: out, info: [{ label: '検出輪郭数', value: `${count}` }] };
      } finally {
        s.done();
      }
    },
  },

  'bounding-rect': {
    defaultSample: 'shapes',
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 200 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        const contours = s.t(new cv.MatVector());
        const hierarchy = s.t(new cv.Mat());
        cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        const out = src.clone();
        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i);
          if (cv.contourArea(c) < num(p.minArea, 200)) continue;
          const r = cv.boundingRect(c);
          cv.rectangle(out, new cv.Point(r.x, r.y), new cv.Point(r.x + r.width, r.y + r.height), ACCENT2(cv), 3);
          count++;
        }
        return { output: out, info: [{ label: '検出物体数', value: `${count}` }] };
      } finally {
        s.done();
      }
    },
  },

  'contour-area': {
    defaultSample: 'shapes',
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 200 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        const contours = s.t(new cv.MatVector());
        const hierarchy = s.t(new cv.Mat());
        cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        const out = src.clone();
        let count = 0;
        let largest = 0;
        for (let i = 0; i < contours.size(); i++) {
          const a = cv.contourArea(contours.get(i));
          if (a < num(p.minArea, 200)) continue;
          largest = Math.max(largest, a);
          cv.drawContours(out, contours, i, ACCENT(cv), 2);
          count++;
        }
        return {
          output: out,
          info: [
            { label: '輪郭数', value: `${count}` },
            { label: '最大面積', value: `${Math.round(largest)} px²` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- shape-detection ----------------
  'hough-circle-detection': {
    defaultSample: 'coins',
    params: [
      { id: 'minDist', label: '中心間最小距離', type: 'slider', min: 10, max: 200, step: 1, default: 40 },
      { id: 'param1', label: 'Canny上限', type: 'slider', min: 30, max: 300, step: 1, default: 100 },
      { id: 'param2', label: '検出しきい値', type: 'slider', min: 10, max: 150, step: 1, default: 40 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        cv.medianBlur(gray, gray, 5);
        const circles = s.t(new cv.Mat());
        cv.HoughCircles(
          gray,
          circles,
          cv.HOUGH_GRADIENT,
          1,
          num(p.minDist, 40),
          num(p.param1, 100),
          num(p.param2, 40),
          0,
          0,
        );
        const out = src.clone();
        for (let i = 0; i < circles.cols; i++) {
          const x = circles.data32F[i * 3];
          const y = circles.data32F[i * 3 + 1];
          const r = circles.data32F[i * 3 + 2];
          cv.circle(out, new cv.Point(x, y), r, ACCENT2(cv), 3);
          cv.circle(out, new cv.Point(x, y), 3, ACCENT(cv), -1);
        }
        return { output: out, info: [{ label: '検出円数', value: `${circles.cols}` }] };
      } finally {
        s.done();
      }
    },
  },

  'hough-line-detection': {
    defaultSample: 'lines',
    params: [
      { id: 'threshold', label: '投票しきい値', type: 'slider', min: 1, max: 300, step: 1, default: 80 },
      { id: 'minLen', label: '最小長', type: 'slider', min: 0, max: 400, step: 1, default: 80 },
      { id: 'maxGap', label: '最大ギャップ', type: 'slider', min: 0, max: 100, step: 1, default: 10 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const edges = s.t(new cv.Mat());
        cv.Canny(gray, edges, 50, 150, 3, false);
        const lines = s.t(new cv.Mat());
        cv.HoughLinesP(edges, lines, 1, Math.PI / 180, num(p.threshold, 80), num(p.minLen, 80), num(p.maxGap, 10));
        const out = src.clone();
        for (let i = 0; i < lines.rows; i++) {
          const x1 = lines.data32S[i * 4];
          const y1 = lines.data32S[i * 4 + 1];
          const x2 = lines.data32S[i * 4 + 2];
          const y2 = lines.data32S[i * 4 + 3];
          cv.line(out, new cv.Point(x1, y1), new cv.Point(x2, y2), ACCENT(cv), 3);
        }
        return { output: out, info: [{ label: '検出直線数', value: `${lines.rows}` }] };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- histogram-analysis ----------------
  'histogram-equalization': {
    defaultSample: 'dark',
    params: [],
    run: (cv, src) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const out = new cv.Mat();
        cv.equalizeHist(gray, out);
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'histogram-calculation': {
    defaultSample: 'scene',
    output: 'chart',
    params: [
      {
        id: 'channel',
        label: 'チャンネル',
        type: 'select',
        default: 'rgb',
        options: [
          { label: 'RGB 全て', value: 'rgb' },
          { label: '輝度 (Gray)', value: 'gray' },
          { label: 'R (赤)', value: 'r' },
          { label: 'G (緑)', value: 'g' },
          { label: 'B (青)', value: 'b' },
        ],
      },
      { id: 'bins', label: 'ビン数', type: 'slider', min: 8, max: 256, step: 8, default: 64 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const bins = Math.max(2, Math.round(num(p.bins, 64)));
        const channel = str(p.channel, 'rgb');
        const series: { label: string; color: string; values: number[] }[] = [];
        const calc = (mat: any, label: string, color: string) => {
          const vec = s.t(new cv.MatVector());
          vec.push_back(mat);
          const hist = s.t(new cv.Mat());
          const mask = s.t(new cv.Mat());
          cv.calcHist(vec, [0], mask, hist, [bins], [0, 256], false);
          const values: number[] = [];
          for (let i = 0; i < bins; i++) values.push(hist.data32F[i]);
          series.push({ label, color, values });
        };
        if (channel === 'gray') {
          const gray = s.t(toGray(cv, src));
          calc(gray, '輝度', '#c7d2fe');
        } else {
          const rgb = s.t(toRGB(cv, src));
          const ch = s.t(new cv.MatVector());
          cv.split(rgb, ch);
          const r = s.t(ch.get(0)), g = s.t(ch.get(1)), b = s.t(ch.get(2));
          if (channel === 'rgb') {
            calc(r, 'R', '#ff4d6d');
            calc(g, 'G', '#34e0a1');
            calc(b, 'B', '#22d3ee');
          } else {
            const pick: Record<string, [any, string, string]> = {
              r: [r, 'R', '#ff4d6d'],
              g: [g, 'G', '#34e0a1'],
              b: [b, 'B', '#22d3ee'],
            };
            const [mat, label, color] = pick[channel] ?? pick.r;
            calc(mat, label, color);
          }
        }
        return {
          chart: { type: 'histogram', bins, range: 255, series, xLabel: '画素値', yLabel: '頻度' },
          info: [
            { label: 'ビン数', value: `${bins}` },
            { label: 'チャンネル', value: channel === 'rgb' ? 'RGB' : channel.toUpperCase() },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'clahe': {
    defaultSample: 'low-contrast',
    params: [
      { id: 'clip', label: 'クリップ上限', type: 'slider', min: 1, max: 10, step: 0.5, default: 4 },
      { id: 'tiles', label: 'タイル分割数', type: 'slider', min: 2, max: 16, step: 1, default: 8 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const tiles = Math.round(num(p.tiles, 8));
        const clahe = s.t(new cv.CLAHE(num(p.clip, 4), new cv.Size(tiles, tiles)));
        const out = new cv.Mat();
        clahe.apply(gray, out);
        return { output: out, info: [{ label: '手法', value: '局所(タイル)均一化 + コントラスト制限' }] };
      } finally {
        s.done();
      }
    },
  },

  'back-projection': {
    defaultSample: 'colored-objects',
    params: [
      { id: 'hue', label: '対象色相 (H)', type: 'slider', min: 0, max: 179, step: 1, default: 0 },
      { id: 'band', label: '色相の幅', type: 'slider', min: 2, max: 40, step: 1, default: 12 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const hsv = s.t(new cv.Mat());
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        const hsvVec = s.t(new cv.MatVector());
        hsvVec.push_back(hsv);
        // Build a target hue histogram from the pixels in the chosen hue band.
        const center = num(p.hue, 0);
        const band = num(p.band, 12);
        const low = s.t(
          new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [Math.max(0, center - band), 70, 50, 0]),
        );
        const high = s.t(
          new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [Math.min(179, center + band), 255, 255, 255]),
        );
        const mask = s.t(new cv.Mat());
        cv.inRange(hsv, low, high, mask);
        const hist = s.t(new cv.Mat());
        cv.calcHist(hsvVec, [0], mask, hist, [180], [0, 180], false);
        cv.normalize(hist, hist, 0, 255, cv.NORM_MINMAX);
        const bp = new cv.Mat();
        cv.calcBackProject(hsvVec, [0], hist, bp, [0, 180], 1);
        const hit = cv.countNonZero(mask);
        const total = mask.rows * mask.cols;
        return {
          output: bp,
          info: [{ label: '対象色の割合', value: `${((hit / total) * 100).toFixed(1)} %` }],
        };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- color-conversion (extra) ----------------
  'color-space-gallery': {
    defaultSample: 'colored-objects',
    params: [
      {
        id: 'space',
        label: '色空間',
        type: 'select',
        default: 'Lab',
        options: [
          { label: 'Lab', value: 'Lab' },
          { label: 'YCrCb', value: 'YCrCb' },
          { label: 'HLS', value: 'HLS' },
          { label: 'XYZ', value: 'XYZ' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const map: Record<string, number> = {
          Lab: cv.COLOR_RGB2Lab,
          YCrCb: cv.COLOR_RGB2YCrCb,
          HLS: cv.COLOR_RGB2HLS,
          XYZ: cv.COLOR_RGB2XYZ,
        };
        const space = str(p.space, 'Lab');
        const out = new cv.Mat();
        cv.cvtColor(rgb, out, map[space] ?? cv.COLOR_RGB2Lab);
        return {
          output: out,
          info: [
            { label: '変換', value: `RGB → ${space}` },
            { label: '表示', value: '各チャンネルを RGB として擬似可視化' },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'mask-operation': {
    defaultSample: 'colored-objects',
    params: [
      {
        id: 'mode',
        label: 'モード',
        type: 'select',
        default: 'keep',
        options: [
          { label: '対象を残す (背景グレー)', value: 'keep' },
          { label: '対象を消す', value: 'remove' },
          { label: '背景を黒に', value: 'bg-black' },
        ],
      },
      { id: 'sat', label: '彩度しきい値', type: 'slider', min: 20, max: 200, step: 5, default: 80 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const hsv = s.t(new cv.Mat());
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        const sat = num(p.sat, 80);
        const low = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, sat, 40, 0]));
        const high = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [179, 255, 255, 255]));
        const mask = s.t(new cv.Mat());
        cv.inRange(hsv, low, high, mask);
        const mode = str(p.mode, 'keep');
        const out = new cv.Mat();
        if (mode === 'remove') {
          rgb.copyTo(out);
          const fill = s.t(new cv.Mat(rgb.rows, rgb.cols, rgb.type(), new cv.Scalar(15, 18, 26)));
          fill.copyTo(out, mask);
        } else if (mode === 'bg-black') {
          cv.bitwise_and(rgb, rgb, out, mask);
        } else {
          const gray = s.t(new cv.Mat());
          cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
          const grayRgb = s.t(new cv.Mat());
          cv.cvtColor(gray, grayRgb, cv.COLOR_GRAY2RGB);
          grayRgb.copyTo(out);
          rgb.copyTo(out, mask);
        }
        const hit = cv.countNonZero(mask);
        const total = mask.rows * mask.cols;
        return { output: out, info: [{ label: 'マスク画素', value: `${((hit / total) * 100).toFixed(1)} %` }] };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- morphology (extra) ----------------
  'morphological-gradient': {
    defaultSample: 'coins',
    params: [
      {
        id: 'op',
        label: '演算',
        type: 'select',
        default: 'gradient',
        options: [
          { label: '勾配 (Gradient)', value: 'gradient' },
          { label: 'トップハット (Top-hat)', value: 'tophat' },
          { label: 'ブラックハット (Black-hat)', value: 'blackhat' },
        ],
      },
      { id: 'k', label: 'カーネルサイズ', type: 'slider', min: 3, max: 31, step: 2, default: 9 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const map: Record<string, number> = {
          gradient: cv.MORPH_GRADIENT,
          tophat: cv.MORPH_TOPHAT,
          blackhat: cv.MORPH_BLACKHAT,
        };
        const k = odd(num(p.k, 9));
        const M = s.t(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(k, k)));
        const out = new cv.Mat();
        cv.morphologyEx(gray, out, map[str(p.op, 'gradient')] ?? cv.MORPH_GRADIENT, M);
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- edge-gradient (extra) ----------------
  'scharr-derivative': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'direction',
        label: '方向',
        type: 'select',
        default: 'x',
        options: [
          { label: 'X 方向', value: 'x' },
          { label: 'Y 方向', value: 'y' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const dir = str(p.direction, 'x');
        const g = s.t(new cv.Mat());
        cv.Scharr(gray, g, cv.CV_16S, dir === 'x' ? 1 : 0, dir === 'x' ? 0 : 1);
        const out = new cv.Mat();
        cv.convertScaleAbs(g, out);
        return { output: out, info: [{ label: '勾配方向', value: dir === 'x' ? '横方向(縦エッジを強調)' : '縦方向(横エッジを強調)' }] };
      } finally {
        s.done();
      }
    },
  },

  'image-pyramids': {
    defaultSample: 'scene',
    params: [
      { id: 'levels', label: '階層数', type: 'slider', min: 1, max: 4, step: 1, default: 2 },
      {
        id: 'direction',
        label: '方向',
        type: 'select',
        default: 'down',
        options: [
          { label: '縮小 (pyrDown)', value: 'down' },
          { label: '拡大 (pyrUp)', value: 'up' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const levels = Math.round(num(p.levels, 2));
        const dir = str(p.direction, 'down');
        const frame = new cv.Mat(src.rows, src.cols, src.type(), new cv.Scalar(13, 16, 24, 255));
        let work = s.t(src.clone());
        if (dir === 'down') {
          for (let i = 0; i < levels; i++) {
            const d = s.t(new cv.Mat());
            cv.pyrDown(work, d);
            work = d;
          }
        } else {
          // Start from a small base so pyrUp visibly enlarges (and memory stays bounded).
          for (let i = 0; i < 4; i++) {
            const d = s.t(new cv.Mat());
            cv.pyrDown(work, d);
            work = d;
          }
          for (let i = 0; i < levels; i++) {
            const u = s.t(new cv.Mat());
            cv.pyrUp(work, u);
            work = u;
          }
        }
        const w = work.cols, h = work.rows;
        const offX = Math.round((src.cols - w) / 2);
        const offY = Math.round((src.rows - h) / 2);
        const fx = Math.max(0, offX), fy = Math.max(0, offY);
        const rx = Math.max(0, -offX), ry = Math.max(0, -offY);
        const cw = Math.min(w - rx, src.cols - fx), ch = Math.min(h - ry, src.rows - fy);
        if (cw > 0 && ch > 0) {
          const sRoi = s.t(work.roi(new cv.Rect(rx, ry, cw, ch)));
          const dRoi = s.t(frame.roi(new cv.Rect(fx, fy, cw, ch)));
          sRoi.copyTo(dRoi);
        }
        return {
          output: frame,
          info: [
            { label: '出力サイズ', value: `${w} × ${h} px` },
            { label: '方向', value: dir === 'down' ? '縮小 (情報が減る)' : '拡大 (ぼやける)' },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- contours-shape (extra) ----------------
  'contour-perimeter': {
    defaultSample: 'shapes',
    params: [
      { id: 'closed', label: '閉曲線として計算', type: 'toggle', default: true },
      { id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 1500 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const { contours } = externalContours(cv, src, s);
        const out = src.clone();
        const closed = p.closed !== false;
        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i);
          if (cv.contourArea(c) < num(p.minArea, 1500)) continue;
          cv.drawContours(out, contours, i, ACCENT(cv), 2);
          const peri = cv.arcLength(c, closed);
          const r = cv.boundingRect(c);
          cv.putText(out, `${Math.round(peri)}`, new cv.Point(r.x, Math.max(18, r.y - 6)),
            cv.FONT_HERSHEY_SIMPLEX, 0.8, ACCENT2(cv), 2);
          count++;
        }
        return {
          output: out,
          info: [
            { label: '輪郭数', value: `${count}` },
            { label: '閉曲線', value: closed ? 'はい' : 'いいえ (開曲線・短くなる)' },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'polygon-approximation': {
    defaultSample: 'shapes',
    params: [
      { id: 'epsilon', label: '近似精度 (周囲長比)', type: 'slider', min: 0.005, max: 0.12, step: 0.005, default: 0.02 },
      { id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 1500 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const { contours } = externalContours(cv, src, s);
        const out = src.clone();
        let total = 0;
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i);
          if (cv.contourArea(c) < num(p.minArea, 1500)) continue;
          const peri = cv.arcLength(c, true);
          const approx = s.t(new cv.Mat());
          cv.approxPolyDP(c, approx, num(p.epsilon, 0.02) * peri, true);
          const mv = s.t(new cv.MatVector());
          mv.push_back(approx);
          cv.drawContours(out, mv, 0, ACCENT(cv), 3);
          for (let j = 0; j < approx.rows; j++) {
            cv.circle(out, new cv.Point(approx.data32S[j * 2], approx.data32S[j * 2 + 1]), 6, ACCENT2(cv), -1);
          }
          total++;
        }
        return {
          output: out,
          info: [
            { label: '対象図形数', value: `${total}` },
            { label: 'ヒント', value: '精度を上げると頂点が減る' },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'rotated-rect': {
    defaultSample: 'shapes',
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 1500 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const { contours } = externalContours(cv, src, s);
        const out = src.clone();
        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i);
          if (cv.contourArea(c) < num(p.minArea, 1500)) continue;
          const pts = rotatedRectPoints(cv.minAreaRect(c));
          for (let j = 0; j < 4; j++) {
            cv.line(out, new cv.Point(pts[j].x, pts[j].y),
              new cv.Point(pts[(j + 1) % 4].x, pts[(j + 1) % 4].y), ACCENT2(cv), 3);
          }
          count++;
        }
        return { output: out, info: [{ label: '検出数', value: `${count}` }] };
      } finally {
        s.done();
      }
    },
  },

  'min-enclosing-circle': {
    defaultSample: 'shapes',
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 1500 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const { contours } = externalContours(cv, src, s);
        const out = src.clone();
        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i);
          if (cv.contourArea(c) < num(p.minArea, 1500)) continue;
          const circle = cv.minEnclosingCircle(c);
          const center = new cv.Point(circle.center.x, circle.center.y);
          cv.circle(out, center, Math.round(circle.radius), ACCENT2(cv), 3);
          cv.circle(out, center, 4, ACCENT(cv), -1);
          count++;
        }
        return { output: out, info: [{ label: '検出数', value: `${count}` }] };
      } finally {
        s.done();
      }
    },
  },

  'convex-hull': {
    defaultSample: 'shapes',
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 1500 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const { contours } = externalContours(cv, src, s);
        const out = src.clone();
        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i);
          if (cv.contourArea(c) < num(p.minArea, 1500)) continue;
          cv.drawContours(out, contours, i, FAINT(cv), 1);
          const hull = s.t(new cv.Mat());
          cv.convexHull(c, hull, false, true);
          const mv = s.t(new cv.MatVector());
          mv.push_back(hull);
          cv.drawContours(out, mv, 0, ACCENT(cv), 3);
          count++;
        }
        return {
          output: out,
          info: [
            { label: '対象図形数', value: `${count}` },
            { label: 'ヒント', value: '星形で凸包と元輪郭の差が見える' },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'image-moments': {
    defaultSample: 'shapes',
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 1500 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const { contours } = externalContours(cv, src, s);
        const out = src.clone();
        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i);
          if (cv.contourArea(c) < num(p.minArea, 1500)) continue;
          const M = cv.moments(c, false);
          if (M.m00 === 0) continue;
          const cx = M.m10 / M.m00, cy = M.m01 / M.m00;
          cv.drawContours(out, contours, i, FAINT(cv), 1);
          cv.circle(out, new cv.Point(cx, cy), 7, ACCENT(cv), -1);
          cv.line(out, new cv.Point(cx - 13, cy), new cv.Point(cx + 13, cy), ACCENT2(cv), 2);
          cv.line(out, new cv.Point(cx, cy - 13), new cv.Point(cx, cy + 13), ACCENT2(cv), 2);
          count++;
        }
        return { output: out, info: [{ label: '重心数', value: `${count}` }] };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- geometric-transform (extra) ----------------
  'image-translation': {
    defaultSample: 'shapes',
    params: [
      { id: 'tx', label: 'X 移動', type: 'slider', min: -300, max: 300, step: 5, default: 60 },
      { id: 'ty', label: 'Y 移動', type: 'slider', min: -300, max: 300, step: 5, default: 40 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const M = s.t(cv.matFromArray(2, 3, cv.CV_64F, [1, 0, num(p.tx, 60), 0, 1, num(p.ty, 40)]));
        const out = new cv.Mat();
        cv.warpAffine(src, out, M, new cv.Size(src.cols, src.rows), cv.INTER_LINEAR,
          cv.BORDER_CONSTANT, new cv.Scalar(13, 16, 24, 255));
        return { output: out, info: [{ label: '移動量', value: `(${Math.round(num(p.tx, 60))}, ${Math.round(num(p.ty, 40))}) px` }] };
      } finally {
        s.done();
      }
    },
  },

  'document-scanner': {
    defaultSample: 'document',
    params: [
      { id: 'autoDetect', label: '四隅自動検出+補正', type: 'toggle', default: true },
      { id: 'binarize', label: '適応的二値化', type: 'toggle', default: true },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const auto = p.autoDetect !== false;
        const binarize = p.binarize !== false;
        let warped: any = null;
        let detected = false;
        if (auto) {
          const gray = s.t(toGray(cv, src));
          const blur = s.t(new cv.Mat());
          cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
          // The page is a bright solid region on a darker background — threshold it
          // into a filled mask, then take its outer contour as the page quad. (More
          // robust than Canny edges, which trace the inner text lines too.)
          const bin = s.t(new cv.Mat());
          cv.threshold(blur, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
          const M = s.t(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9)));
          cv.morphologyEx(bin, bin, cv.MORPH_CLOSE, M);
          const contours = s.t(new cv.MatVector());
          const hier = s.t(new cv.Mat());
          cv.findContours(bin, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
          const minArea = rgb.rows * rgb.cols * 0.1;
          let bestPts: { x: number; y: number }[] | null = null;
          let bestArea = 0;
          for (let i = 0; i < contours.size(); i++) {
            const c = contours.get(i);
            const area = cv.contourArea(c);
            if (area < minArea || area <= bestArea) continue;
            const peri = cv.arcLength(c, true);
            const approx = s.t(new cv.Mat());
            cv.approxPolyDP(c, approx, 0.02 * peri, true);
            if (approx.rows === 4) {
              bestArea = area;
              bestPts = [0, 1, 2, 3].map((j) => ({ x: approx.data32S[j * 2], y: approx.data32S[j * 2 + 1] }));
            }
          }
          if (bestPts) {
            const [tl, tr, br, bl] = orderQuad(bestPts);
            const W = Math.round(Math.max(dist2(tl, tr), dist2(bl, br)));
            const H = Math.round(Math.max(dist2(tl, bl), dist2(tr, br)));
            if (W > 10 && H > 10) {
              const srcM = s.t(cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]));
              const dstM = s.t(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H]));
              const T = s.t(cv.getPerspectiveTransform(srcM, dstM));
              warped = s.t(new cv.Mat());
              cv.warpPerspective(rgb, warped, T, new cv.Size(W, H));
              detected = true;
            }
          }
        }
        if (!warped) warped = s.t(rgb.clone());
        let out: any;
        if (binarize) {
          const g = s.t(new cv.Mat());
          cv.cvtColor(warped, g, cv.COLOR_RGB2GRAY);
          out = new cv.Mat();
          cv.adaptiveThreshold(g, out, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);
        } else {
          out = warped.clone();
        }
        return {
          output: out,
          info: [
            { label: '四隅検出', value: auto ? (detected ? '成功' : '失敗→元画像') : 'オフ' },
            { label: '二値化', value: binarize ? 'あり' : 'なし' },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- segmentation (extra) ----------------
  'watershed': {
    defaultSample: 'coins',
    params: [{ id: 'fg', label: '前景しきい値', type: 'slider', min: 0.2, max: 0.9, step: 0.05, default: 0.5 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        const M = s.t(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)));
        const opening = s.t(new cv.Mat());
        cv.morphologyEx(bin, opening, cv.MORPH_OPEN, M, new cv.Point(-1, -1), 2);
        const sureBg = s.t(new cv.Mat());
        cv.dilate(opening, sureBg, M, new cv.Point(-1, -1), 3);
        const dist = s.t(new cv.Mat());
        cv.distanceTransform(opening, dist, cv.DIST_L2, 5);
        const dm = cv.minMaxLoc(dist);
        const sureFg = s.t(new cv.Mat());
        cv.threshold(dist, sureFg, num(p.fg, 0.5) * dm.maxVal, 255, cv.THRESH_BINARY);
        const sureFg8 = s.t(new cv.Mat());
        sureFg.convertTo(sureFg8, cv.CV_8U);
        const unknown = s.t(new cv.Mat());
        cv.subtract(sureBg, sureFg8, unknown);
        const markers = s.t(new cv.Mat());
        const ncc = cv.connectedComponents(sureFg8, markers);
        const one = s.t(new cv.Mat(markers.rows, markers.cols, markers.type(), new cv.Scalar(1)));
        cv.add(markers, one, markers);
        const n = markers.rows * markers.cols;
        const md = markers.data32S;
        const ud = unknown.data;
        for (let i = 0; i < n; i++) if (ud[i] > 0) md[i] = 0;
        cv.watershed(rgb, markers);
        const out = src.clone();
        const od = out.data;
        // Tint each segmented region with its label color (so the segmentation —
        // and how it responds to the threshold — is clearly visible), draw
        // watershed boundaries (marker === -1) in red.
        for (let i = 0; i < n; i++) {
          const m = md[i];
          if (m === -1) {
            od[i * 4] = 255;
            od[i * 4 + 1] = 64;
            od[i * 4 + 2] = 64;
          } else if (m > 1) {
            const c = LABEL_COLORS[(m - 2) % LABEL_COLORS.length];
            od[i * 4] = Math.round(od[i * 4] * 0.5 + c[0] * 0.5);
            od[i * 4 + 1] = Math.round(od[i * 4 + 1] * 0.5 + c[1] * 0.5);
            od[i * 4 + 2] = Math.round(od[i * 4 + 2] * 0.5 + c[2] * 0.5);
          }
        }
        return { output: out, info: [{ label: '検出領域数', value: `${Math.max(0, ncc - 1)}` }] };
      } finally {
        s.done();
      }
    },
  },

  'connected-components': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'connectivity',
        label: '連結数 (4/8近傍)',
        type: 'select',
        default: '8',
        options: [
          { label: '4 近傍', value: '4' },
          { label: '8 近傍', value: '8' },
        ],
      },
      { id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 250, default: 500 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        const labels = s.t(new cv.Mat());
        const stats = s.t(new cv.Mat());
        const centroids = s.t(new cv.Mat());
        const conn = Number(str(p.connectivity, '8'));
        const total = cv.connectedComponentsWithStats(bin, labels, stats, centroids, conn, cv.CV_32S);
        const minArea = num(p.minArea, 500);
        const colorByLabel: ([number, number, number] | null)[] = new Array(total).fill(null);
        let kept = 0;
        for (let l = 1; l < total; l++) {
          if (stats.intAt(l, cv.CC_STAT_AREA) < minArea) continue;
          colorByLabel[l] = LABEL_COLORS[kept % LABEL_COLORS.length];
          kept++;
        }
        const out = new cv.Mat(src.rows, src.cols, cv.CV_8UC3);
        const od = out.data;
        const ld = labels.data32S;
        const n = src.rows * src.cols;
        for (let i = 0; i < n; i++) {
          const c = colorByLabel[ld[i]];
          if (c) {
            od[i * 3] = c[0];
            od[i * 3 + 1] = c[1];
            od[i * 3 + 2] = c[2];
          } else {
            od[i * 3] = 15;
            od[i * 3 + 1] = 18;
            od[i * 3 + 2] = 26;
          }
        }
        return { output: out, info: [{ label: '連結成分数', value: `${kept}` }] };
      } finally {
        s.done();
      }
    },
  },

  'kmeans-color-quantization': {
    defaultSample: 'scene',
    params: [{ id: 'k', label: 'クラスタ数 (色数)', type: 'slider', min: 2, max: 24, step: 1, default: 8 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb0 = s.t(toRGB(cv, src));
        // Downscale for speed; preview normalizes to the frame anyway.
        let rgb = rgb0;
        const maxW = 320;
        if (rgb0.cols > maxW) {
          const r = s.t(new cv.Mat());
          const sc = maxW / rgb0.cols;
          cv.resize(rgb0, r, new cv.Size(maxW, Math.round(rgb0.rows * sc)), 0, 0, cv.INTER_AREA);
          rgb = r;
        }
        const K = Math.max(2, Math.round(num(p.k, 8)));
        const N = rgb.rows * rgb.cols;
        // Build the (N x 3) float sample matrix directly — Mat.reshape isn't bound
        // in this opencv.js build.
        const samples32 = s.t(new cv.Mat(N, 3, cv.CV_32F));
        const sd = samples32.data32F;
        const rd = rgb.data;
        for (let i = 0; i < N * 3; i++) sd[i] = rd[i];
        const labels = s.t(new cv.Mat());
        const centers = s.t(new cv.Mat());
        const TC_EPS = cv.TermCriteria_EPS ?? cv.TERM_CRITERIA_EPS ?? 2;
        const TC_ITER = cv.TermCriteria_MAX_ITER ?? cv.TERM_CRITERIA_MAX_ITER ?? cv.TermCriteria_COUNT ?? 1;
        const criteria = new cv.TermCriteria(TC_EPS + TC_ITER, 10, 1.0);
        cv.kmeans(samples32, K, labels, criteria, 3, cv.KMEANS_PP_CENTERS, centers);
        const out = new cv.Mat(rgb.rows, rgb.cols, cv.CV_8UC3);
        const od = out.data;
        const ld = labels.data32S;
        const cd = centers.data32F;
        const n = rgb.rows * rgb.cols;
        for (let i = 0; i < n; i++) {
          const l = ld[i];
          od[i * 3] = Math.round(cd[l * 3]);
          od[i * 3 + 1] = Math.round(cd[l * 3 + 1]);
          od[i * 3 + 2] = Math.round(cd[l * 3 + 2]);
        }
        return { output: out, info: [{ label: '色数 (K)', value: `${K}` }] };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- feature-detection (extra) ----------------
  'harris-corner': {
    defaultSample: 'lines',
    params: [
      { id: 'blockSize', label: 'ブロックサイズ', type: 'slider', min: 2, max: 12, step: 1, default: 3 },
      { id: 'k', label: 'k (感度)', type: 'slider', min: 0.01, max: 0.2, step: 0.01, default: 0.04 },
      { id: 'thresh', label: '検出しきい値 (最大値比)', type: 'slider', min: 0.01, max: 0.6, step: 0.01, default: 0.1 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const gray32 = s.t(new cv.Mat());
        gray.convertTo(gray32, cv.CV_32F);
        const dst = s.t(new cv.Mat());
        cv.cornerHarris(gray32, dst, Math.round(num(p.blockSize, 3)), 3, num(p.k, 0.04));
        // Dilate the response so corner peaks survive downsampling and read clearly.
        const dil = s.t(new cv.Mat());
        cv.dilate(dst, dil, new cv.Mat());
        const mm = cv.minMaxLoc(dil);
        const thr = mm.maxVal * num(p.thresh, 0.1);
        const out = src.clone();
        const dd = dil.data32F;
        const cols = dil.cols;
        let count = 0;
        // Mark on a downsampled grid to avoid drawing thousands of overlapping dots.
        for (let y = 0; y < dil.rows; y += 2) {
          for (let x = 0; x < cols; x += 2) {
            if (dd[y * cols + x] > thr) {
              cv.circle(out, new cv.Point(x, y), 4, ACCENT(cv), -1);
              count++;
            }
          }
        }
        return { output: out, info: [{ label: 'コーナー検出点', value: `${count}` }] };
      } finally {
        s.done();
      }
    },
  },

  'shi-tomasi-corner': {
    defaultSample: 'document',
    params: [
      { id: 'maxCorners', label: '最大点数', type: 'slider', min: 1, max: 300, step: 1, default: 60 },
      { id: 'quality', label: '品質レベル', type: 'slider', min: 0.01, max: 0.6, step: 0.01, default: 0.05 },
      { id: 'minDistance', label: '最小距離', type: 'slider', min: 1, max: 60, step: 1, default: 10 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const corners = s.t(new cv.Mat());
        cv.goodFeaturesToTrack(gray, corners, Math.round(num(p.maxCorners, 60)),
          num(p.quality, 0.02), num(p.minDistance, 10));
        const out = src.clone();
        for (let i = 0; i < corners.rows; i++) {
          const pt = new cv.Point(corners.data32F[i * 2], corners.data32F[i * 2 + 1]);
          cv.circle(out, pt, 8, ACCENT2(cv), 2);
          cv.circle(out, pt, 2, ACCENT(cv), -1);
        }
        return { output: out, info: [{ label: '検出点数', value: `${corners.rows}` }] };
      } finally {
        s.done();
      }
    },
  },

  'orb-features': {
    defaultSample: 'noisy',
    params: [{ id: 'nfeatures', label: '特徴点数', type: 'slider', min: 50, max: 1000, step: 50, default: 400 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const orb = s.t(new cv.ORB(Math.round(num(p.nfeatures, 400))));
        const kp = s.t(new cv.KeyPointVector());
        const des = s.t(new cv.Mat());
        const mask = s.t(new cv.Mat());
        orb.detectAndCompute(gray, mask, kp, des);
        const out = src.clone();
        const nk = kp.size();
        for (let i = 0; i < nk; i++) {
          const k = kp.get(i);
          cv.circle(out, new cv.Point(k.pt.x, k.pt.y), Math.max(2, Math.round(k.size / 2)), ACCENT(cv), 1);
        }
        return { output: out, info: [{ label: '特徴点数', value: `${nk}` }] };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- spatial input (point / rect drawing) ----------------
  'image-crop': {
    defaultSample: 'scene',
    params: [{ id: 'rect', label: '切り抜き範囲', type: 'rect', default: [0.22, 0.2, 0.5, 0.5] }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const [x, y, w, h] = clampRect(p.rect, src.cols, src.rows);
        const view = s.t(src.roi(new cv.Rect(x, y, w, h)));
        const out = view.clone();
        return { output: out, info: [{ label: 'ROI', value: `${w}×${h} px @ (${x}, ${y})` }] };
      } finally {
        s.done();
      }
    },
  },

  'flood-fill': {
    defaultSample: 'shapes',
    params: [
      { id: 'seed', label: '開始点', type: 'points', count: 1, pointLabels: ['開始点'], default: [[0.5, 0.28]] },
      { id: 'tol', label: '許容差', type: 'slider', min: 0, max: 80, step: 1, default: 22 },
      {
        id: 'color',
        label: '塗り色',
        type: 'select',
        default: 'violet',
        options: [
          { label: '紫', value: 'violet' },
          { label: 'シアン', value: 'cyan' },
          { label: '赤', value: 'red' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const out = rgb.clone();
        const [sx, sy] = clampPoint((p.seed && p.seed[0]) || [src.cols / 2, src.rows / 2], src.cols, src.rows);
        const tol = num(p.tol, 22);
        const palette: Record<string, [number, number, number]> = {
          violet: [124, 92, 255], cyan: [34, 211, 238], red: [255, 77, 109],
        };
        const c = palette[str(p.color, 'violet')] ?? palette.violet;
        const mask = s.t(new cv.Mat(src.rows + 2, src.cols + 2, cv.CV_8U, new cv.Scalar(0)));
        const rect = new cv.Rect();
        cv.floodFill(
          out, mask, new cv.Point(sx, sy), new cv.Scalar(c[0], c[1], c[2], 255), rect,
          new cv.Scalar(tol, tol, tol, tol), new cv.Scalar(tol, tol, tol, tol), 8,
        );
        const area = cv.countNonZero(s.t(mask.roi(new cv.Rect(1, 1, src.cols, src.rows))));
        cv.circle(out, new cv.Point(sx, sy), 6, new cv.Scalar(255, 255, 255, 255), 2);
        return {
          output: out,
          info: [
            { label: '開始点', value: `(${sx}, ${sy})` },
            { label: '塗り面積', value: `${((area / (src.cols * src.rows)) * 100).toFixed(1)} %` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'affine-transform': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'points',
        label: '変換先の3点（元画像の左上・右上・左下が動く先）',
        type: 'points',
        count: 3,
        pointLabels: ['左上', '右上', '左下'],
        default: [[0.12, 0.16], [0.84, 0.1], [0.22, 0.86]],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const W = src.cols, H = src.rows;
        const d = p.points && p.points.length === 3 ? p.points : [[0, 0], [W, 0], [0, H]];
        const srcTri = s.t(cv.matFromArray(3, 1, cv.CV_32FC2, [0, 0, W, 0, 0, H]));
        const dstTri = s.t(cv.matFromArray(3, 1, cv.CV_32FC2,
          [d[0][0], d[0][1], d[1][0], d[1][1], d[2][0], d[2][1]]));
        const M = s.t(cv.getAffineTransform(srcTri, dstTri));
        const out = new cv.Mat();
        cv.warpAffine(src, out, M, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_CONSTANT,
          new cv.Scalar(13, 16, 24, 255));
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'perspective-transform': {
    defaultSample: 'document',
    params: [
      {
        id: 'points',
        label: '変換元の4点（この四角形を正面化）',
        type: 'points',
        count: 4,
        pointLabels: ['左上', '右上', '右下', '左下'],
        default: [[0.22, 0.16], [0.8, 0.22], [0.84, 0.84], [0.16, 0.8]],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const W = src.cols, H = src.rows;
        const q = p.points && p.points.length === 4 ? p.points : [[0, 0], [W, 0], [W, H], [0, H]];
        const srcQ = s.t(cv.matFromArray(4, 1, cv.CV_32FC2,
          [q[0][0], q[0][1], q[1][0], q[1][1], q[2][0], q[2][1], q[3][0], q[3][1]]));
        const dstQ = s.t(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, W, 0, W, H, 0, H]));
        const M = s.t(cv.getPerspectiveTransform(srcQ, dstQ));
        const out = new cv.Mat();
        cv.warpPerspective(src, out, M, new cv.Size(W, H), cv.INTER_LINEAR, cv.BORDER_CONSTANT,
          new cv.Scalar(13, 16, 24, 255));
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'grabcut': {
    defaultSample: 'colored-objects',
    params: [
      { id: 'rect', label: '前景を囲む矩形', type: 'rect', default: [0.12, 0.12, 0.74, 0.74] },
      { id: 'iter', label: '反復回数', type: 'slider', min: 1, max: 5, step: 1, default: 3 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb0 = s.t(toRGB(cv, src));
        // GrabCut is heavy — run on a downscaled copy, then upscale the mask.
        const maxW = 320;
        const scale = rgb0.cols > maxW ? maxW / rgb0.cols : 1;
        const rgb = scale < 1 ? s.t(new cv.Mat()) : rgb0;
        if (scale < 1) {
          cv.resize(rgb0, rgb, new cv.Size(Math.round(rgb0.cols * scale), Math.round(rgb0.rows * scale)), 0, 0, cv.INTER_AREA);
        }
        const [fx, fy, fw, fh] = clampRect(p.rect, src.cols, src.rows);
        let x = Math.round(fx * scale), y = Math.round(fy * scale);
        let w = Math.round(fw * scale), h = Math.round(fh * scale);
        x = Math.max(1, Math.min(x, rgb.cols - 3));
        y = Math.max(1, Math.min(y, rgb.rows - 3));
        w = Math.max(2, Math.min(w, rgb.cols - x - 1));
        h = Math.max(2, Math.min(h, rgb.rows - y - 1));
        const mask = s.t(new cv.Mat());
        const bgd = s.t(new cv.Mat());
        const fgd = s.t(new cv.Mat());
        cv.grabCut(rgb, mask, new cv.Rect(x, y, w, h), bgd, fgd, Math.round(num(p.iter, 3)), cv.GC_INIT_WITH_RECT);
        // mask: 1/3 = (probable) foreground. Upscale the fg mask to full size.
        const fgSmall = s.t(new cv.Mat(rgb.rows, rgb.cols, cv.CV_8U, new cv.Scalar(0)));
        const ms = mask.data, fs = fgSmall.data;
        for (let i = 0; i < rgb.rows * rgb.cols; i++) fs[i] = ms[i] === 1 || ms[i] === 3 ? 255 : 0;
        const fgFull = s.t(new cv.Mat());
        cv.resize(fgSmall, fgFull, new cv.Size(src.cols, src.rows), 0, 0, cv.INTER_NEAREST);
        const out = new cv.Mat(src.rows, src.cols, cv.CV_8UC3, new cv.Scalar(15, 18, 26));
        rgb0.copyTo(out, fgFull);
        const fgCount = cv.countNonZero(fgFull);
        return {
          output: out,
          info: [{ label: '前景の割合', value: `${((fgCount / (src.cols * src.rows)) * 100).toFixed(1)} %` }],
        };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- two-image demos ----------------
  'image-arithmetic': {
    defaultSample: 'scene',
    secondSample: 'colored-objects',
    params: [
      {
        id: 'op',
        label: '演算',
        type: 'select',
        default: 'blend',
        options: [
          { label: '加重合成 (blend)', value: 'blend' },
          { label: '加算 (add)', value: 'add' },
          { label: '減算 (A−B)', value: 'subtract' },
          { label: '差分 (|A−B|)', value: 'absdiff' },
        ],
      },
      { id: 'alpha', label: '画像Aの重み α (blend時)', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.5 },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const a = s.t(toRGB(cv, src));
        if (!extras?.srcB) return { output: a.clone() };
        const bRaw = s.t(toRGB(cv, extras.srcB));
        const b = s.t(new cv.Mat());
        cv.resize(bRaw, b, new cv.Size(a.cols, a.rows), 0, 0, cv.INTER_AREA);
        const op = str(p.op, 'blend');
        const out = new cv.Mat();
        if (op === 'add') cv.add(a, b, out);
        else if (op === 'subtract') cv.subtract(a, b, out);
        else if (op === 'absdiff') cv.absdiff(a, b, out);
        else {
          const al = num(p.alpha, 0.5);
          cv.addWeighted(a, al, b, 1 - al, 0, out);
        }
        return { output: out, info: [{ label: '演算', value: op }] };
      } finally {
        s.done();
      }
    },
  },

  'histogram-comparison': {
    defaultSample: 'scene',
    secondSample: 'dark',
    output: 'chart',
    params: [
      {
        id: 'method',
        label: '比較法',
        type: 'select',
        default: 'correl',
        options: [
          { label: '相関 (Correlation)', value: 'correl' },
          { label: 'カイ二乗 (Chi-Square)', value: 'chisqr' },
          { label: '交差 (Intersection)', value: 'intersect' },
          { label: 'Bhattacharyya', value: 'bhattacharyya' },
        ],
      },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const bins = 64;
        const histOf = (mat: any) => {
          const gray = s.t(toGray(cv, mat));
          const vec = s.t(new cv.MatVector());
          vec.push_back(gray);
          const h = s.t(new cv.Mat());
          const mask = s.t(new cv.Mat());
          cv.calcHist(vec, [0], mask, h, [bins], [0, 256], false);
          return h;
        };
        const readVals = (h: any) => {
          const v: number[] = [];
          for (let i = 0; i < bins; i++) v.push(h.data32F[i]);
          return v;
        };
        const hA = histOf(src);
        const series = [{ label: '画像A', color: '#7c5cff', values: readVals(hA) }];
        let scoreLabel = 'B画像なし';
        if (extras?.srcB) {
          const hB = histOf(extras.srcB);
          series.push({ label: '画像B', color: '#22d3ee', values: readVals(hB) });
          const hAn = s.t(new cv.Mat());
          const hBn = s.t(new cv.Mat());
          cv.normalize(hA, hAn, 0, 1, cv.NORM_MINMAX);
          cv.normalize(hB, hBn, 0, 1, cv.NORM_MINMAX);
          const methods: Record<string, number> = {
            correl: cv.HISTCMP_CORREL, chisqr: cv.HISTCMP_CHISQR,
            intersect: cv.HISTCMP_INTERSECT, bhattacharyya: cv.HISTCMP_BHATTACHARYYA,
          };
          const m = str(p.method, 'correl');
          const d = cv.compareHist(hAn, hBn, methods[m] ?? cv.HISTCMP_CORREL);
          scoreLabel = `${m} = ${d.toFixed(4)}`;
        }
        return {
          chart: { type: 'histogram', bins, range: 255, series, xLabel: `類似度 ${scoreLabel}` },
          info: [{ label: '類似度', value: scoreLabel }],
        };
      } finally {
        s.done();
      }
    },
  },

  'shape-matching': {
    defaultSample: 'shapes',
    secondSample: 'coins',
    params: [
      {
        id: 'method',
        label: '比較法 (Huモーメント)',
        type: 'select',
        default: '1',
        options: [
          { label: 'I1', value: '1' },
          { label: 'I2', value: '2' },
          { label: 'I3', value: '3' },
        ],
      },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const H = 320;
        const prep = (mat: any) => {
          const rgb = s.t(toRGB(cv, mat));
          const { contours, best } = largestContour(cv, mat, s);
          if (best >= 0) cv.drawContours(rgb, contours, best, ACCENT(cv), 5);
          const scaled = s.t(new cv.Mat());
          const w = Math.max(1, Math.round((rgb.cols * H) / rgb.rows));
          cv.resize(rgb, scaled, new cv.Size(w, H), 0, 0, cv.INTER_AREA);
          return { scaled, contour: best >= 0 ? s.t(contours.get(best)) : null };
        };
        const A = prep(src);
        const B = extras?.srcB ? prep(extras.srcB) : null;
        const wB = B ? B.scaled.cols + 8 : 0;
        const out = new cv.Mat(H, A.scaled.cols + wB, cv.CV_8UC3, new cv.Scalar(13, 16, 24));
        A.scaled.copyTo(s.t(out.roi(new cv.Rect(0, 0, A.scaled.cols, H))));
        if (B) B.scaled.copyTo(s.t(out.roi(new cv.Rect(A.scaled.cols + 8, 0, B.scaled.cols, H))));
        let score = '—';
        if (A.contour && B?.contour) {
          const method = Number(str(p.method, '1'));
          score = cv.matchShapes(A.contour, B.contour, method, 0).toFixed(4);
        }
        cv.putText(out, `match = ${score}`, new cv.Point(10, 30), cv.FONT_HERSHEY_SIMPLEX, 0.9, ACCENT2(cv), 2);
        return { output: out, info: [{ label: '形状の差 (0=同一)', value: score }] };
      } finally {
        s.done();
      }
    },
  },

  'template-matching': {
    defaultSample: 'shapes',
    secondSample: 'shapes',
    params: [
      {
        id: 'method',
        label: '評価法',
        type: 'select',
        default: 'ccoeff',
        options: [
          { label: 'CCOEFF_NORMED', value: 'ccoeff' },
          { label: 'CCORR_NORMED', value: 'ccorr' },
          { label: 'SQDIFF_NORMED', value: 'sqdiff' },
        ],
      },
      { id: 'threshold', label: '検出しきい値', type: 'slider', min: 0.3, max: 1, step: 0.01, default: 0.85 },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const aGray = s.t(toGray(cv, src));
        if (!extras?.srcB) return { output: src.clone() };
        const bGray0 = s.t(toGray(cv, extras.srcB));
        const bGray = s.t(new cv.Mat());
        cv.resize(bGray0, bGray, new cv.Size(aGray.cols, aGray.rows), 0, 0, cv.INTER_AREA);
        // template = centre crop of B
        const tw = Math.round(aGray.cols * 0.42);
        const th = Math.round(aGray.rows * 0.42);
        const tx = Math.round((aGray.cols - tw) / 2);
        const ty = Math.round((aGray.rows - th) / 2);
        const tmpl = s.t(bGray.roi(new cv.Rect(tx, ty, tw, th)));
        const res = s.t(new cv.Mat());
        const methods: Record<string, number> = {
          ccoeff: cv.TM_CCOEFF_NORMED, ccorr: cv.TM_CCORR_NORMED, sqdiff: cv.TM_SQDIFF_NORMED,
        };
        const mkey = str(p.method, 'ccoeff');
        cv.matchTemplate(aGray, tmpl, res, methods[mkey] ?? cv.TM_CCOEFF_NORMED);
        const mm = cv.minMaxLoc(res);
        const isSq = mkey === 'sqdiff';
        const best = isSq ? mm.minLoc : mm.maxLoc;
        const bestScore = isSq ? 1 - mm.minVal : mm.maxVal;
        const out = src.clone();
        const thr = num(p.threshold, 0.85);
        // faint boxes for every above-threshold location
        const rd = res.data32F;
        let hits = 0;
        for (let y = 0; y < res.rows; y += 3) {
          for (let x = 0; x < res.cols; x += 3) {
            const v = rd[y * res.cols + x];
            const pass = isSq ? v <= 1 - thr : v >= thr;
            if (pass) {
              cv.rectangle(out, new cv.Point(x, y), new cv.Point(x + tw, y + th), new cv.Scalar(124, 92, 255, 160), 1);
              hits++;
            }
          }
        }
        cv.rectangle(out, new cv.Point(best.x, best.y), new cv.Point(best.x + tw, best.y + th), ACCENT2(cv), 3);
        return {
          output: out,
          info: [
            { label: '最良スコア', value: bestScore.toFixed(3) },
            { label: '採用箇所', value: `${hits}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'feature-matching': {
    defaultSample: 'noisy',
    secondSample: 'noisy',
    params: [
      { id: 'maxMatches', label: '表示マッチ数', type: 'slider', min: 5, max: 80, step: 5, default: 30 },
      { id: 'rotateB', label: '画像Bを回転 (°)', type: 'slider', min: 0, max: 90, step: 5, default: 25 },
      { id: 'crossCheck', label: 'クロスチェック', type: 'toggle', default: true },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const aRgb = s.t(toRGB(cv, src));
        let bRgb: any;
        if (extras?.srcB) {
          const b0 = s.t(toRGB(cv, extras.srcB));
          const ang = num(p.rotateB, 25);
          if (ang !== 0) {
            const M = s.t(cv.getRotationMatrix2D(new cv.Point(b0.cols / 2, b0.rows / 2), ang, 1));
            bRgb = s.t(new cv.Mat());
            cv.warpAffine(b0, bRgb, M, new cv.Size(b0.cols, b0.rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(13, 16, 24));
          } else bRgb = b0;
        } else bRgb = s.t(aRgb.clone());
        const gA = s.t(new cv.Mat()); cv.cvtColor(aRgb, gA, cv.COLOR_RGB2GRAY);
        const gB = s.t(new cv.Mat()); cv.cvtColor(bRgb, gB, cv.COLOR_RGB2GRAY);
        const A = orbDetect(cv, gA, s, 500);
        const B = orbDetect(cv, gB, s, 500);
        const top = bfMatchTopN(cv, A.des, B.des, s, Math.round(num(p.maxMatches, 30)), p.crossCheck !== false);
        const { out, offX } = sideBySide(cv, aRgb, bRgb);
        for (const m of top) {
          const pa = A.pts[m.q], pb = B.pts[m.t];
          if (!pa || !pb) continue;
          cv.line(out, new cv.Point(pa[0], pa[1]), new cv.Point(pb[0] + offX, pb[1]), ACCENT(cv), 1);
          cv.circle(out, new cv.Point(pa[0], pa[1]), 3, ACCENT2(cv), 1);
          cv.circle(out, new cv.Point(pb[0] + offX, pb[1]), 3, ACCENT2(cv), 1);
        }
        return {
          output: out,
          info: [
            { label: '特徴点 A / B', value: `${A.pts.length} / ${B.pts.length}` },
            { label: '表示マッチ数', value: `${top.length}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'homography-estimation': {
    defaultSample: 'noisy',
    secondSample: 'noisy',
    params: [
      { id: 'rotateB', label: '画像Bを回転 (°)', type: 'slider', min: 0, max: 60, step: 5, default: 25 },
      { id: 'ransac', label: 'RANSAC 閾値', type: 'slider', min: 1, max: 20, step: 1, default: 5 },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const aRgb = s.t(toRGB(cv, src));
        let bRgb: any;
        if (extras?.srcB) {
          const b0 = s.t(toRGB(cv, extras.srcB));
          const ang = num(p.rotateB, 25);
          if (ang !== 0) {
            const M = s.t(cv.getRotationMatrix2D(new cv.Point(b0.cols / 2, b0.rows / 2), ang, 1));
            bRgb = s.t(new cv.Mat());
            cv.warpAffine(b0, bRgb, M, new cv.Size(b0.cols, b0.rows), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(13, 16, 24));
          } else bRgb = b0;
        } else bRgb = s.t(aRgb.clone());
        const gA = s.t(new cv.Mat()); cv.cvtColor(aRgb, gA, cv.COLOR_RGB2GRAY);
        const gB = s.t(new cv.Mat()); cv.cvtColor(bRgb, gB, cv.COLOR_RGB2GRAY);
        const A = orbDetect(cv, gA, s, 700);
        const B = orbDetect(cv, gB, s, 700);
        const top = bfMatchTopN(cv, A.des, B.des, s, 80, true);
        const { out, offX } = sideBySide(cv, aRgb, bRgb);
        let inliers = 0;
        if (top.length >= 4) {
          const srcArr: number[] = [];
          const dstArr: number[] = [];
          for (const m of top) {
            const pa = A.pts[m.q], pb = B.pts[m.t];
            if (!pa || !pb) continue;
            srcArr.push(pa[0], pa[1]);
            dstArr.push(pb[0], pb[1]);
          }
          const nPts = srcArr.length / 2;
          if (nPts >= 4) {
            const srcM = s.t(cv.matFromArray(nPts, 1, cv.CV_32FC2, srcArr));
            const dstM = s.t(cv.matFromArray(nPts, 1, cv.CV_32FC2, dstArr));
            const mask = s.t(new cv.Mat());
            const Hm = s.t(cv.findHomography(srcM, dstM, cv.RANSAC, num(p.ransac, 5), mask));
            if (Hm && !Hm.empty()) {
              const corners = s.t(cv.matFromArray(4, 1, cv.CV_32FC2,
                [0, 0, aRgb.cols, 0, aRgb.cols, aRgb.rows, 0, aRgb.rows]));
              const proj = s.t(new cv.Mat());
              cv.perspectiveTransform(corners, proj, Hm);
              for (let i = 0; i < 4; i++) {
                const x1 = proj.data32F[i * 2] + offX, y1 = proj.data32F[i * 2 + 1];
                const j = (i + 1) % 4;
                const x2 = proj.data32F[j * 2] + offX, y2 = proj.data32F[j * 2 + 1];
                cv.line(out, new cv.Point(x1, y1), new cv.Point(x2, y2), ACCENT(cv), 4);
              }
              inliers = cv.countNonZero(mask);
            }
          }
        }
        return {
          output: out,
          info: [
            { label: 'マッチ数', value: `${top.length}` },
            { label: 'インライア (RANSAC)', value: `${inliers}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- video / camera demos (stateful frame loop) ----------------
  'webcam-capture': {
    defaultSample: 'scene',
    input: 'video',
    params: [
      {
        id: 'filter',
        label: 'フィルタ',
        type: 'select',
        default: 'none',
        options: [
          { label: 'なし', value: 'none' },
          { label: 'グレースケール', value: 'gray' },
          { label: 'Canny エッジ', value: 'canny' },
          { label: 'セピア', value: 'sepia' },
          { label: '色反転', value: 'invert' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const f = str(p.filter, 'none');
        if (f === 'gray') {
          const out = new cv.Mat();
          cv.cvtColor(src, out, cv.COLOR_RGBA2GRAY);
          return { output: out };
        }
        if (f === 'invert') {
          const rgb = s.t(toRGB(cv, src));
          const out = new cv.Mat();
          cv.bitwise_not(rgb, out);
          return { output: out };
        }
        if (f === 'canny') {
          const g = s.t(toGray(cv, src));
          const out = new cv.Mat();
          cv.Canny(g, out, 50, 150);
          return { output: out };
        }
        if (f === 'sepia') {
          const rgb = s.t(toRGB(cv, src));
          const m = s.t(cv.matFromArray(3, 3, cv.CV_32F,
            [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131]));
          const out = new cv.Mat();
          cv.transform(rgb, out, m);
          return { output: out };
        }
        return { output: src.clone() };
      } finally {
        s.done();
      }
    },
  },

  'background-subtraction': {
    defaultSample: 'scene',
    input: 'video',
    params: [
      { id: 'varThreshold', label: '感度 (varThreshold)', type: 'slider', min: 8, max: 64, step: 2, default: 16 },
      {
        id: 'show',
        label: '表示',
        type: 'select',
        default: 'mask',
        options: [
          { label: '前景マスク', value: 'mask' },
          { label: '前景のみ', value: 'fg' },
        ],
      },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const st = extras?.state ?? {};
        const vt = num(p.varThreshold, 16);
        if (extras?.firstFrame || !st.bg || st.vt !== vt) {
          st.bg?.delete?.();
          st.bg = new cv.BackgroundSubtractorMOG2(200, vt, true);
          st.vt = vt;
        }
        const rgb = s.t(toRGB(cv, src));
        const fg = s.t(new cv.Mat());
        st.bg.apply(rgb, fg);
        const mask = s.t(new cv.Mat());
        cv.threshold(fg, mask, 200, 255, cv.THRESH_BINARY); // drop MOG2 shadow (=127)
        if (str(p.show, 'mask') === 'mask') return { output: mask.clone() };
        const out = new cv.Mat(src.rows, src.cols, cv.CV_8UC3, new cv.Scalar(15, 18, 26));
        rgb.copyTo(out, mask);
        return { output: out, info: [{ label: '前景率', value: `${((cv.countNonZero(mask) / (src.rows * src.cols)) * 100).toFixed(1)} %` }] };
      } finally {
        s.done();
      }
    },
  },

  'frame-differencing': {
    defaultSample: 'scene',
    input: 'video',
    params: [
      { id: 'thresh', label: 'しきい値', type: 'slider', min: 5, max: 80, step: 1, default: 25 },
      {
        id: 'show',
        label: '表示',
        type: 'select',
        default: 'overlay',
        options: [
          { label: '動体ハイライト', value: 'overlay' },
          { label: '差分マスク', value: 'mask' },
        ],
      },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const st = extras?.state ?? {};
        const gray = s.t(toGray(cv, src));
        if (!st.prev) {
          st.prev = gray.clone();
          return { output: new cv.Mat(src.rows, src.cols, cv.CV_8UC1, new cv.Scalar(0)) };
        }
        const diff = s.t(new cv.Mat());
        cv.absdiff(gray, st.prev, diff);
        const mask = s.t(new cv.Mat());
        cv.threshold(diff, mask, num(p.thresh, 25), 255, cv.THRESH_BINARY);
        st.prev.delete();
        st.prev = gray.clone();
        const motion = ((cv.countNonZero(mask) / (src.rows * src.cols)) * 100).toFixed(1);
        if (str(p.show, 'overlay') === 'mask') return { output: mask.clone(), info: [{ label: '動き', value: `${motion} %` }] };
        const out = s.t(toRGB(cv, src)).clone();
        const od = out.data, md = mask.data;
        const n = src.rows * src.cols;
        for (let i = 0; i < n; i++) {
          if (md[i]) { od[i * 3] = 255; od[i * 3 + 1] = 64; od[i * 3 + 2] = 64; }
        }
        return { output: out, info: [{ label: '動き', value: `${motion} %` }] };
      } finally {
        s.done();
      }
    },
  },

  'optical-flow-lk': {
    defaultSample: 'scene',
    input: 'video',
    params: [
      { id: 'maxCorners', label: '追跡点数', type: 'slider', min: 20, max: 300, step: 10, default: 120 },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const st = extras?.state ?? {};
        const gray = s.t(toGray(cv, src));
        const maxC = Math.round(num(p.maxCorners, 120));
        const needDetect = extras?.firstFrame || !st.prevGray || !st.pts || st.pts.rows < 12 || (st.frame ?? 0) % 25 === 0;
        if (needDetect) {
          st.pts?.delete?.();
          const pts = new cv.Mat();
          cv.goodFeaturesToTrack(gray, pts, maxC, 0.01, 10);
          st.pts = pts;
          st.prevGray?.delete?.();
          st.prevGray = gray.clone();
          st.frame = (st.frame ?? 0) + 1;
          const out = src.clone();
          for (let i = 0; i < pts.rows; i++) {
            cv.circle(out, new cv.Point(pts.data32F[i * 2], pts.data32F[i * 2 + 1]), 3, ACCENT2(cv), -1);
          }
          return { output: out, info: [{ label: '追跡点', value: `${pts.rows}` }] };
        }
        const next = s.t(new cv.Mat());
        const status = s.t(new cv.Mat());
        const err = s.t(new cv.Mat());
        cv.calcOpticalFlowPyrLK(st.prevGray, gray, st.pts, next, status, err);
        const out = src.clone();
        const good: number[] = [];
        for (let i = 0; i < status.rows; i++) {
          if (status.data[i] === 1) {
            const x0 = st.pts.data32F[i * 2], y0 = st.pts.data32F[i * 2 + 1];
            const x1 = next.data32F[i * 2], y1 = next.data32F[i * 2 + 1];
            cv.line(out, new cv.Point(x0, y0), new cv.Point(x1, y1), ACCENT(cv), 2);
            cv.circle(out, new cv.Point(x1, y1), 3, ACCENT2(cv), -1);
            good.push(x1, y1);
          }
        }
        st.prevGray.delete();
        st.prevGray = gray.clone();
        st.pts.delete();
        const np = new cv.Mat(good.length / 2, 1, cv.CV_32FC2);
        for (let i = 0; i < good.length; i++) np.data32F[i] = good[i];
        st.pts = np;
        st.frame = (st.frame ?? 0) + 1;
        return { output: out, info: [{ label: '追跡点', value: `${good.length / 2}` }] };
      } finally {
        s.done();
      }
    },
  },

  'dense-optical-flow': {
    defaultSample: 'scene',
    input: 'video',
    params: [
      { id: 'amp', label: '動きの強調', type: 'slider', min: 1, max: 12, step: 1, default: 4 },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const st = extras?.state ?? {};
        // Downscale for Farneback performance, then upscale the colour map.
        const grayFull = s.t(toGray(cv, src));
        const W = 240, H = Math.max(1, Math.round((src.rows / src.cols) * 240));
        const gray = s.t(new cv.Mat());
        cv.resize(grayFull, gray, new cv.Size(W, H), 0, 0, cv.INTER_AREA);
        if (!st.prevGray) {
          st.prevGray = gray.clone();
          return { output: new cv.Mat(src.rows, src.cols, cv.CV_8UC3, new cv.Scalar(15, 18, 26)) };
        }
        const flow = s.t(new cv.Mat());
        cv.calcOpticalFlowFarneback(st.prevGray, gray, flow, 0.5, 3, 15, 3, 5, 1.2, 0);
        st.prevGray.delete();
        st.prevGray = gray.clone();
        const parts = s.t(new cv.MatVector());
        cv.split(flow, parts);
        const fx = s.t(parts.get(0)), fy = s.t(parts.get(1));
        const mag = s.t(new cv.Mat()), ang = s.t(new cv.Mat());
        cv.cartToPolar(fx, fy, mag, ang, true);
        const hsv = s.t(new cv.Mat(H, W, cv.CV_8UC3));
        const hd = hsv.data, magd = mag.data32F, angd = ang.data32F;
        const amp = num(p.amp, 4);
        for (let i = 0; i < W * H; i++) {
          const m = magd[i];
          // Noise floor suppresses static-area flicker; above it, amplify so even
          // modest motion lights up clearly (hue = direction, value = speed).
          hd[i * 3] = Math.round(angd[i] / 2) % 180;
          hd[i * 3 + 1] = 255;
          hd[i * 3 + 2] = m < 0.35 ? 0 : Math.min(255, m * amp * 40);
        }
        const rgbSmall = s.t(new cv.Mat());
        cv.cvtColor(hsv, rgbSmall, cv.COLOR_HSV2RGB);
        const out = new cv.Mat();
        cv.resize(rgbSmall, out, new cv.Size(src.cols, src.rows), 0, 0, cv.INTER_LINEAR);
        return { output: out, info: [{ label: '色', value: '色相=向き / 明度=速さ' }] };
      } finally {
        s.done();
      }
    },
  },

  'meanshift-camshift': {
    defaultSample: 'scene',
    input: 'video',
    params: [
      {
        id: 'mode',
        label: '手法',
        type: 'select',
        default: 'camshift',
        options: [
          { label: 'CamShift (回転・拡縮対応)', value: 'camshift' },
          { label: 'MeanShift', value: 'meanshift' },
        ],
      },
    ],
    run: (cv, src, p, extras) => {
      const s = new Scope();
      try {
        const st = extras?.state ?? {};
        const rgb = s.t(toRGB(cv, src));
        const hsv = s.t(new cv.Mat());
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        if (extras?.firstFrame || !st.hist || !st.win) {
          const w = Math.round(src.cols * 0.3), h = Math.round(src.rows * 0.3);
          st.win = [Math.round((src.cols - w) / 2), Math.round((src.rows - h) / 2), w, h];
          const roi = s.t(hsv.roi(new cv.Rect(st.win[0], st.win[1], w, h)));
          const roiVec = s.t(new cv.MatVector());
          roiVec.push_back(roi);
          const emptyMask = s.t(new cv.Mat());
          st.hist?.delete?.();
          const hist = new cv.Mat();
          cv.calcHist(roiVec, [0], emptyMask, hist, [16], [0, 180], false);
          cv.normalize(hist, hist, 0, 255, cv.NORM_MINMAX);
          st.hist = hist;
        }
        const hsvVec = s.t(new cv.MatVector());
        hsvVec.push_back(hsv);
        const bp = s.t(new cv.Mat());
        cv.calcBackProject(hsvVec, [0], st.hist, bp, [0, 180], 1);
        const tcEps = cv.TermCriteria_EPS ?? cv.TERM_CRITERIA_EPS ?? 2;
        const tcCount = cv.TermCriteria_COUNT ?? cv.TermCriteria_MAX_ITER ?? cv.TERM_CRITERIA_COUNT ?? 1;
        const crit = s.t(new cv.TermCriteria(tcEps + tcCount, 10, 1));
        let win = new cv.Rect(st.win[0], st.win[1], st.win[2], st.win[3]);
        const out = rgb.clone();
        // opencv.js returns [retval/rotatedRect, updatedWindow] from these.
        if (str(p.mode, 'camshift') === 'meanshift') {
          const ret = cv.meanShift(bp, win, crit);
          if (Array.isArray(ret) && ret[1]) win = ret[1];
          cv.rectangle(out, new cv.Point(win.x, win.y), new cv.Point(win.x + win.width, win.y + win.height), ACCENT2(cv), 3);
        } else {
          const ret = cv.CamShift(bp, win, crit);
          const rr = Array.isArray(ret) ? ret[0] : ret;
          if (Array.isArray(ret) && ret[1]) win = ret[1];
          if (rr && rr.center) {
            const pts = rotatedRectPoints(rr);
            for (let j = 0; j < 4; j++) {
              cv.line(out, new cv.Point(pts[j].x, pts[j].y), new cv.Point(pts[(j + 1) % 4].x, pts[(j + 1) % 4].y), ACCENT(cv), 3);
            }
          } else {
            cv.rectangle(out, new cv.Point(win.x, win.y), new cv.Point(win.x + win.width, win.y + win.height), ACCENT2(cv), 3);
          }
        }
        st.win = [win.x, win.y, win.width, win.height];
        return { output: out, info: [{ label: '追跡窓', value: `${win.width}×${win.height}` }] };
      } finally {
        s.done();
      }
    },
  },

  // ---------------- misc (bitwise / kernels / contours / ML / photo) ----------------
  'bitwise-operations': {
    defaultSample: 'scene',
    params: [
      {
        id: 'op',
        label: '演算',
        type: 'select',
        default: 'and',
        options: [
          { label: 'AND (積)', value: 'and' },
          { label: 'OR (和)', value: 'or' },
          { label: 'XOR (排他)', value: 'xor' },
          { label: 'NOT (反転)', value: 'not' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const op = str(p.op, 'and');
        const out = new cv.Mat();
        if (op === 'not') {
          cv.bitwise_not(rgb, out);
          return { output: out, info: [{ label: '演算', value: 'NOT (色反転)' }] };
        }
        // operand = two overlapping white shapes (a mask pattern)
        const pat = s.t(new cv.Mat(rgb.rows, rgb.cols, cv.CV_8UC3, new cv.Scalar(0, 0, 0)));
        cv.circle(pat, new cv.Point(rgb.cols * 0.38, rgb.rows * 0.5),
          Math.min(rgb.rows, rgb.cols) * 0.32, new cv.Scalar(255, 255, 255), -1);
        cv.rectangle(pat, new cv.Point(rgb.cols * 0.5, rgb.rows * 0.28),
          new cv.Point(rgb.cols * 0.82, rgb.rows * 0.72), new cv.Scalar(255, 255, 255), -1);
        if (op === 'or') cv.bitwise_or(rgb, pat, out);
        else if (op === 'xor') cv.bitwise_xor(rgb, pat, out);
        else cv.bitwise_and(rgb, pat, out);
        return { output: out, info: [{ label: '演算', value: `画像 ${op.toUpperCase()} 白形状` }] };
      } finally {
        s.done();
      }
    },
  },

  'draw-contours': {
    defaultSample: 'shapes',
    params: [
      { id: 'thickness', label: '線の太さ (-1で塗りつぶし)', type: 'slider', min: -1, max: 8, step: 1, default: 3 },
      {
        id: 'which',
        label: '描画対象',
        type: 'select',
        default: 'all',
        options: [
          { label: 'すべての輪郭', value: 'all' },
          { label: '最大の輪郭のみ', value: 'largest' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const { contours } = externalContours(cv, src, s);
        const out = src.clone();
        const th = Math.round(num(p.thickness, 3));
        if (str(p.which, 'all') === 'largest') {
          let bi = -1, ba = 0;
          for (let i = 0; i < contours.size(); i++) {
            const a = cv.contourArea(contours.get(i));
            if (a > ba) { ba = a; bi = i; }
          }
          if (bi >= 0) cv.drawContours(out, contours, bi, ACCENT(cv), th);
        } else {
          for (let i = 0; i < contours.size(); i++) cv.drawContours(out, contours, i, ACCENT(cv), th);
        }
        return { output: out, info: [{ label: '輪郭数', value: `${contours.size()}` }] };
      } finally {
        s.done();
      }
    },
  },

  'custom-kernel-filter2d': {
    defaultSample: 'scene',
    params: [
      {
        id: 'kernel',
        label: 'カーネル (3×3)',
        type: 'select',
        default: 'sharpen',
        options: [
          { label: 'シャープ化', value: 'sharpen' },
          { label: 'エッジ検出', value: 'edge' },
          { label: 'エンボス', value: 'emboss' },
          { label: '平均ぼかし', value: 'box' },
          { label: '輪郭強調', value: 'outline' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const kernels: Record<string, number[]> = {
          sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0],
          edge: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
          emboss: [-2, -1, 0, -1, 1, 1, 0, 1, 2],
          box: Array(9).fill(1 / 9),
          outline: [-1, -1, -1, -1, 9, -1, -1, -1, -1],
        };
        const k = s.t(cv.matFromArray(3, 3, cv.CV_32F, kernels[str(p.kernel, 'sharpen')] ?? kernels.sharpen));
        const rgb = s.t(toRGB(cv, src));
        const out = new cv.Mat();
        cv.filter2D(rgb, out, -1, k);
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'kmeans-clustering': {
    defaultSample: 'scene',
    params: [{ id: 'k', label: 'クラスタ数 K', type: 'slider', min: 2, max: 10, step: 1, default: 3 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const W = src.cols, H = src.rows;
        // Deterministic 2D point cloud arranged in 5 blobs (seeded LCG for stability).
        let seed = 987654321;
        const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        const blobs = [[0.25, 0.3], [0.7, 0.25], [0.5, 0.55], [0.3, 0.78], [0.78, 0.72]];
        const N = 250;
        const xy: number[] = [];
        for (let i = 0; i < N; i++) {
          const c = blobs[i % blobs.length];
          xy.push((c[0] + (rnd() - 0.5) * 0.18) * W, (c[1] + (rnd() - 0.5) * 0.18) * H);
        }
        const samples = s.t(cv.matFromArray(N, 2, cv.CV_32F, xy));
        const K = Math.round(num(p.k, 3));
        const labels = s.t(new cv.Mat(N, 1, cv.CV_32S));
        const centers = s.t(new cv.Mat());
        const TC_EPS = cv.TermCriteria_EPS ?? cv.TERM_CRITERIA_EPS ?? 2;
        const TC_ITER = cv.TermCriteria_MAX_ITER ?? cv.TermCriteria_COUNT ?? 1;
        const crit = new cv.TermCriteria(TC_EPS + TC_ITER, 10, 1);
        cv.kmeans(samples, K, labels, crit, 5, cv.KMEANS_PP_CENTERS, centers);
        const out = new cv.Mat(H, W, cv.CV_8UC3, new cv.Scalar(15, 18, 26));
        for (let i = 0; i < N; i++) {
          const c = LABEL_COLORS[labels.intAt(i, 0) % LABEL_COLORS.length];
          cv.circle(out, new cv.Point(xy[i * 2], xy[i * 2 + 1]), 5, new cv.Scalar(c[0], c[1], c[2]), -1);
        }
        for (let j = 0; j < K; j++) {
          const cx = centers.data32F[j * 2], cy = centers.data32F[j * 2 + 1];
          cv.line(out, new cv.Point(cx - 13, cy - 13), new cv.Point(cx + 13, cy + 13), new cv.Scalar(255, 255, 255), 3);
          cv.line(out, new cv.Point(cx - 13, cy + 13), new cv.Point(cx + 13, cy - 13), new cv.Scalar(255, 255, 255), 3);
        }
        return { output: out, info: [{ label: 'データ点', value: `${N}` }, { label: 'クラスタ数', value: `${K}` }] };
      } finally {
        s.done();
      }
    },
  },

  'inpainting': {
    defaultSample: 'scene',
    params: [
      { id: 'rect', label: '消す領域', type: 'rect', default: [0.6, 0.12, 0.28, 0.28] },
      { id: 'radius', label: '補完半径', type: 'slider', min: 1, max: 15, step: 1, default: 3 },
      {
        id: 'method',
        label: '手法',
        type: 'select',
        default: 'telea',
        options: [
          { label: 'TELEA', value: 'telea' },
          { label: 'Navier-Stokes', value: 'ns' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const [x, y, w, h] = clampRect(p.rect, src.cols, src.rows);
        const mask = s.t(new cv.Mat(src.rows, src.cols, cv.CV_8UC1, new cv.Scalar(0)));
        cv.rectangle(mask, new cv.Point(x, y), new cv.Point(x + w, y + h), new cv.Scalar(255), -1);
        const out = new cv.Mat();
        const flag = str(p.method, 'telea') === 'ns' ? cv.INPAINT_NS : cv.INPAINT_TELEA;
        cv.inpaint(rgb, mask, out, num(p.radius, 3), flag);
        return { output: out, info: [{ label: '消した領域', value: `${w} × ${h} px` }] };
      } finally {
        s.done();
      }
    },
  },

  'stylization-filters': {
    defaultSample: 'scene',
    params: [
      {
        id: 'effect',
        label: '効果',
        type: 'select',
        default: 'pencil',
        options: [
          { label: '鉛筆画', value: 'pencil' },
          { label: 'カートゥーン', value: 'cartoon' },
          { label: 'エッジ保持平滑', value: 'smooth' },
        ],
      },
    ],
    // photo モジュール(stylization等)は opencv.js 標準ビルド未収録のため imgproc で近似。
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const effect = str(p.effect, 'pencil');
        if (effect === 'smooth') {
          const out = new cv.Mat();
          cv.bilateralFilter(rgb, out, 15, 80, 80, cv.BORDER_DEFAULT);
          return { output: out };
        }
        if (effect === 'cartoon') {
          const smooth = s.t(new cv.Mat());
          cv.bilateralFilter(rgb, smooth, 11, 90, 90, cv.BORDER_DEFAULT);
          const gray = s.t(new cv.Mat());
          cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
          const edges = s.t(new cv.Mat());
          cv.adaptiveThreshold(gray, edges, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY, 9, 7);
          const edges3 = s.t(new cv.Mat());
          cv.cvtColor(edges, edges3, cv.COLOR_GRAY2RGB);
          const out = new cv.Mat();
          cv.bitwise_and(smooth, edges3, out);
          return { output: out };
        }
        // pencil sketch: gray → invert → blur → colour-dodge
        const gray = s.t(new cv.Mat());
        cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
        const inv = s.t(new cv.Mat());
        cv.bitwise_not(gray, inv);
        const blur = s.t(new cv.Mat());
        cv.GaussianBlur(inv, blur, new cv.Size(21, 21), 0);
        const out = new cv.Mat(gray.rows, gray.cols, cv.CV_8UC1);
        const gd = gray.data, bd = blur.data, od = out.data;
        const n = gray.rows * gray.cols;
        for (let i = 0; i < n; i++) {
          const denom = 255 - bd[i];
          od[i] = denom <= 0 ? 255 : Math.min(255, Math.round((gd[i] * 255) / denom));
        }
        return { output: out };
      } finally {
        s.done();
      }
    },
  },

  'sift-features': {
    defaultSample: 'noisy',
    // SIFT is not compiled into this opencv.js build — AKAZE is a scale/rotation-
    // invariant alternative that IS available, so we use it (and say so).
    params: [{ id: 'thresh', label: '検出感度 (小さいほど多い)', type: 'slider', min: 0.0005, max: 0.008, step: 0.0005, default: 0.002 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const gray = s.t(toGray(cv, src));
        const akaze = s.t(new cv.AKAZE());
        akaze.setThreshold?.(num(p.thresh, 0.002));
        const kp = s.t(new cv.KeyPointVector());
        const des = s.t(new cv.Mat());
        const mask = s.t(new cv.Mat());
        akaze.detectAndCompute(gray, mask, kp, des);
        const out = src.clone();
        const nk = kp.size();
        for (let i = 0; i < nk; i++) {
          const k = kp.get(i);
          const r = Math.max(3, Math.round(k.size / 2));
          cv.circle(out, new cv.Point(k.pt.x, k.pt.y), r, ACCENT(cv), 1);
          const a = (k.angle * Math.PI) / 180;
          cv.line(out, new cv.Point(k.pt.x, k.pt.y),
            new cv.Point(k.pt.x + r * Math.cos(a), k.pt.y + r * Math.sin(a)), ACCENT2(cv), 1);
        }
        return {
          output: out,
          info: [
            { label: '特徴点数', value: `${nk}` },
            { label: '手法', value: 'AKAZE (SIFT非搭載のため代替)' },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'panorama-stitching': {
    defaultSample: 'scene',
    // Stitcher is absent from opencv.js — build the panorama by hand with
    // ORB → BFMatcher → findHomography → warpPerspective. To guarantee a working
    // default we synthesize two overlapping views (left half + a tilted right half).
    params: [{ id: 'angle', label: '右画像の傾き (°)', type: 'slider', min: -15, max: 15, step: 1, default: 8 }],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const W = rgb.cols, H = rgb.rows;
        const leftW = Math.round(W * 0.62);
        const rightX = Math.round(W * 0.38), rightW = W - rightX;
        const left = s.t(rgb.roi(new cv.Rect(0, 0, leftW, H)).clone());
        const rightRaw = s.t(rgb.roi(new cv.Rect(rightX, 0, rightW, H)).clone());
        // Tilt the right view so the homography has real work to do.
        const right = s.t(new cv.Mat());
        const Mr = s.t(cv.getRotationMatrix2D(new cv.Point(rightW / 2, H / 2), num(p.angle, 8), 1));
        cv.warpAffine(rightRaw, right, Mr, new cv.Size(rightW, H), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(13, 16, 24));
        const gL = s.t(new cv.Mat()); cv.cvtColor(left, gL, cv.COLOR_RGB2GRAY);
        const gR = s.t(new cv.Mat()); cv.cvtColor(right, gR, cv.COLOR_RGB2GRAY);
        const A = orbDetect(cv, gL, s, 800);
        const B = orbDetect(cv, gR, s, 800);
        const top = bfMatchTopN(cv, B.des, A.des, s, 150, true); // right(query) → left(train)
        const srcArr: number[] = [], dstArr: number[] = [];
        for (const m of top) {
          const pb = B.pts[m.q], pa = A.pts[m.t];
          if (!pb || !pa) continue;
          srcArr.push(pb[0], pb[1]);
          dstArr.push(pa[0], pa[1]);
        }
        const nPts = srcArr.length / 2;
        const panoW = leftW + rightW;
        const out = new cv.Mat(H, panoW, cv.CV_8UC3, new cv.Scalar(13, 16, 24));
        let inliers = 0;
        if (nPts >= 4) {
          const srcM = s.t(cv.matFromArray(nPts, 1, cv.CV_32FC2, srcArr));
          const dstM = s.t(cv.matFromArray(nPts, 1, cv.CV_32FC2, dstArr));
          const mask = s.t(new cv.Mat());
          const Hm = s.t(cv.findHomography(srcM, dstM, cv.RANSAC, 5, mask));
          if (Hm && !Hm.empty()) {
            const warped = s.t(new cv.Mat());
            cv.warpPerspective(right, warped, Hm, new cv.Size(panoW, H), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(13, 16, 24));
            warped.copyTo(s.t(out.roi(new cv.Rect(0, 0, panoW, H))));
            left.copyTo(s.t(out.roi(new cv.Rect(0, 0, leftW, H)))); // left on top of the seam
            inliers = cv.countNonZero(mask);
            cv.line(out, new cv.Point(leftW, 0), new cv.Point(leftW, H), new cv.Scalar(124, 92, 255), 1);
            return {
              output: out,
              info: [
                { label: 'マッチ数', value: `${top.length}` },
                { label: 'インライア', value: `${inliers}` },
                { label: '合成幅', value: `${W}px → ${panoW}px` },
              ],
            };
          }
        }
        left.copyTo(s.t(out.roi(new cv.Rect(0, 0, leftW, H))));
        right.copyTo(s.t(out.roi(new cv.Rect(leftW, 0, Math.min(rightW, panoW - leftW), H))));
        return { output: out, info: [{ label: '結果', value: 'マッチ不足で単純連結' }] };
      } finally {
        s.done();
      }
    },
  },

  // ================= 組み合わせレシピ (multi-step pipelines) =================
  // Each recipe exposes a "stage" select so the intermediate result of the
  // pipeline can be viewed step by step.

  'recipe-line-enhance': {
    defaultSample: 'document',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① グレースケール', value: 'gray' },
          { label: '② 適応的二値化', value: 'thresh' },
          { label: '③ モルフォロジー閉 (完成)', value: 'final' },
        ],
      },
      { id: 'block', label: '適応ブロックサイズ', type: 'slider', min: 3, max: 51, step: 2, default: 15 },
      { id: 'C', label: '定数 C', type: 'slider', min: -20, max: 20, step: 1, default: 8 },
      { id: 'k', label: 'モルフォロジー カーネル', type: 'slider', min: 1, max: 9, step: 2, default: 3 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        if (stage === 'gray') return { output: gray.clone(), info: [{ label: 'ステップ', value: '① グレースケール化' }] };
        const th = s.t(new cv.Mat());
        cv.adaptiveThreshold(gray, th, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, odd(num(p.block, 15)), num(p.C, 8));
        if (stage === 'thresh') return { output: th.clone(), info: [{ label: 'ステップ', value: '② 適応的二値化(局所しきい値)' }] };
        const M = s.t(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(odd(num(p.k, 3)), odd(num(p.k, 3)))));
        const out = new cv.Mat();
        cv.morphologyEx(th, out, cv.MORPH_CLOSE, M);
        return { output: out, info: [{ label: 'パイプライン', value: 'gray → 適応的二値化 → 閉処理' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-clean-binarize': {
    defaultSample: 'noisy',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① グレースケール', value: 'gray' },
          { label: '② ガウシアンぼかし', value: 'blur' },
          { label: '③ Otsu 二値化 (完成)', value: 'final' },
        ],
      },
      { id: 'k', label: 'ぼかしカーネル', type: 'slider', min: 1, max: 15, step: 2, default: 5 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        if (stage === 'gray') return { output: gray.clone(), info: [{ label: 'ステップ', value: '① グレースケール化' }] };
        const blur = s.t(new cv.Mat());
        const k = odd(num(p.k, 5));
        cv.GaussianBlur(gray, blur, new cv.Size(k, k), 0);
        if (stage === 'blur') return { output: blur.clone(), info: [{ label: 'ステップ', value: `② ガウシアンぼかし ${k}×${k}` }] };
        const out = new cv.Mat();
        const t = cv.threshold(blur, out, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: 'gray → ぼかし → Otsu' },
            { label: '自動しきい値', value: `${Math.round(t)}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-color-segment': {
    defaultSample: 'colored-objects',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① HSV inRange マスク', value: 'mask' },
          { label: '② モルフォロジー清掃', value: 'clean' },
          { label: '③ マスク適用 (完成)', value: 'final' },
        ],
      },
      { id: 'hLow', label: '色相 下限', type: 'slider', min: 0, max: 179, step: 1, default: 35 },
      { id: 'hHigh', label: '色相 上限', type: 'slider', min: 0, max: 179, step: 1, default: 85 },
      { id: 'sMin', label: '彩度 下限', type: 'slider', min: 0, max: 255, step: 5, default: 70 },
      { id: 'k', label: '清掃カーネル', type: 'slider', min: 1, max: 15, step: 2, default: 5 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        const hsv = s.t(new cv.Mat());
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        const low = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [num(p.hLow, 35), num(p.sMin, 70), 40, 0]));
        const high = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [num(p.hHigh, 85), 255, 255, 255]));
        const mask = s.t(new cv.Mat());
        cv.inRange(hsv, low, high, mask);
        if (stage === 'mask') return { output: mask.clone(), info: [{ label: 'ステップ', value: '① HSV inRange マスク' }] };
        const M = s.t(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(odd(num(p.k, 5)), odd(num(p.k, 5)))));
        const clean = s.t(new cv.Mat());
        cv.morphologyEx(mask, clean, cv.MORPH_OPEN, M);
        cv.morphologyEx(clean, clean, cv.MORPH_CLOSE, M);
        if (stage === 'clean') return { output: clean.clone(), info: [{ label: 'ステップ', value: '② 開→閉でマスク清掃' }] };
        const out = new cv.Mat();
        cv.bitwise_and(rgb, rgb, out, clean);
        const hit = cv.countNonZero(clean);
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: 'HSV → inRange → 清掃 → bitwise_and' },
            { label: '抽出画素', value: `${((hit / (mask.rows * mask.cols)) * 100).toFixed(1)} %` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-blob-count': {
    defaultSample: 'coins',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① Otsu 二値化', value: 'binary' },
          { label: '② モルフォロジー開', value: 'opened' },
          { label: '③ 輪郭+カウント (完成)', value: 'final' },
        ],
      },
      { id: 'k', label: '開処理カーネル', type: 'slider', min: 1, max: 15, step: 2, default: 5 },
      { id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 20000, step: 200, default: 800 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        // coins are bright on dark → THRESH_BINARY; works for both via Otsu.
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        if (stage === 'binary') return { output: bin.clone(), info: [{ label: 'ステップ', value: '① Otsu 二値化' }] };
        const M = s.t(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(odd(num(p.k, 5)), odd(num(p.k, 5)))));
        const opened = s.t(new cv.Mat());
        cv.morphologyEx(bin, opened, cv.MORPH_OPEN, M);
        if (stage === 'opened') return { output: opened.clone(), info: [{ label: 'ステップ', value: '② 開処理でノイズ除去' }] };
        const contours = s.t(new cv.MatVector());
        const hier = s.t(new cv.Mat());
        cv.findContours(opened, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        const out = src.clone();
        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
          if (cv.contourArea(contours.get(i)) < num(p.minArea, 800)) continue;
          cv.drawContours(out, contours, i, ACCENT(cv), 3);
          const r = cv.boundingRect(contours.get(i));
          cv.putText(out, `${++count}`, new cv.Point(r.x + r.width / 2 - 8, r.y + r.height / 2 + 8),
            cv.FONT_HERSHEY_SIMPLEX, 0.9, ACCENT2(cv), 2);
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: 'Otsu → 開 → 輪郭 → 面積フィルタ' },
            { label: '検出個数', value: `${count}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-shape-classify': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 二値化', value: 'binary' },
          { label: '② 輪郭抽出', value: 'contours' },
          { label: '③ 多角形近似+分類 (完成)', value: 'final' },
        ],
      },
      { id: 'epsilon', label: '近似精度 (周囲長比)', type: 'slider', min: 0.01, max: 0.08, step: 0.005, default: 0.03 },
      { id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 1500 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        if (stage === 'binary') return { output: bin.clone(), info: [{ label: 'ステップ', value: '① 反転Otsu二値化' }] };
        const contours = s.t(new cv.MatVector());
        const hier = s.t(new cv.Mat());
        cv.findContours(bin, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        if (stage === 'contours') {
          const o = src.clone();
          for (let i = 0; i < contours.size(); i++) {
            if (cv.contourArea(contours.get(i)) < num(p.minArea, 1500)) continue;
            cv.drawContours(o, contours, i, ACCENT(cv), 2);
          }
          return { output: o, info: [{ label: 'ステップ', value: '② 輪郭抽出' }] };
        }
        const out = src.clone();
        let n = 0;
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i);
          if (cv.contourArea(c) < num(p.minArea, 1500)) continue;
          const peri = cv.arcLength(c, true);
          const approx = s.t(new cv.Mat());
          cv.approxPolyDP(c, approx, num(p.epsilon, 0.03) * peri, true);
          const v = approx.rows;
          // putText (Hershey font) is ASCII-only, so the on-image label uses
          // romanized names; the Japanese names live in the guide/info.
          const name = v === 3 ? 'Tri' : v === 4 ? 'Quad' : v === 5 ? 'Penta' : v <= 6 ? 'Hexa' : 'Circle';
          const mv = s.t(new cv.MatVector());
          mv.push_back(approx);
          cv.drawContours(out, mv, 0, ACCENT(cv), 3);
          const r = cv.boundingRect(c);
          cv.putText(out, `${name}(${v})`, new cv.Point(r.x, Math.max(18, r.y - 8)),
            cv.FONT_HERSHEY_SIMPLEX, 0.6, ACCENT2(cv), 2);
          n++;
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: '二値化 → 輪郭 → approxPolyDP → 頂点数で分類' },
            { label: '分類した図形', value: `${n}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-line-detect': {
    defaultSample: 'lines',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① Canny エッジ', value: 'edges' },
          { label: '② Hough直線 (完成)', value: 'final' },
        ],
      },
      { id: 't1', label: 'Canny 下限', type: 'slider', min: 0, max: 255, step: 1, default: 50 },
      { id: 't2', label: 'Canny 上限', type: 'slider', min: 0, max: 255, step: 1, default: 150 },
      { id: 'thresh', label: 'Hough 投票しきい値', type: 'slider', min: 1, max: 200, step: 1, default: 60 },
      { id: 'minLen', label: '最小線長', type: 'slider', min: 0, max: 400, step: 5, default: 60 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const blur = s.t(new cv.Mat());
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
        const edges = s.t(new cv.Mat());
        cv.Canny(blur, edges, num(p.t1, 50), num(p.t2, 150), 3, false);
        if (stage === 'edges') return { output: edges.clone(), info: [{ label: 'ステップ', value: '① ぼかし→Canny エッジ' }] };
        const lines = s.t(new cv.Mat());
        cv.HoughLinesP(edges, lines, 1, Math.PI / 180, num(p.thresh, 60), num(p.minLen, 60), 10);
        const out = src.clone();
        for (let i = 0; i < lines.rows; i++) {
          const x1 = lines.data32S[i * 4], y1 = lines.data32S[i * 4 + 1];
          const x2 = lines.data32S[i * 4 + 2], y2 = lines.data32S[i * 4 + 3];
          cv.line(out, new cv.Point(x1, y1), new cv.Point(x2, y2), ACCENT(cv), 3);
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: 'gray → ぼかし → Canny → HoughLinesP' },
            { label: '検出直線数', value: `${lines.rows}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-clahe-enhance': {
    defaultSample: 'low-contrast',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 元画像', value: 'original' },
          { label: '② L成分にCLAHE', value: 'lchan' },
          { label: '③ カラー合成 (完成)', value: 'final' },
        ],
      },
      { id: 'clip', label: 'クリップ上限', type: 'slider', min: 1, max: 10, step: 0.5, default: 3 },
      { id: 'tiles', label: 'タイル分割数', type: 'slider', min: 2, max: 16, step: 1, default: 8 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        if (stage === 'original') return { output: rgb.clone(), info: [{ label: 'ステップ', value: '① 元画像' }] };
        const lab = s.t(new cv.Mat());
        cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);
        const ch = s.t(new cv.MatVector());
        cv.split(lab, ch);
        const L = s.t(ch.get(0)), A = s.t(ch.get(1)), B = s.t(ch.get(2));
        const tiles = Math.round(num(p.tiles, 8));
        const clahe = s.t(new cv.CLAHE(num(p.clip, 3), new cv.Size(tiles, tiles)));
        const L2 = s.t(new cv.Mat());
        clahe.apply(L, L2);
        if (stage === 'lchan') return { output: L2.clone(), info: [{ label: 'ステップ', value: '② 明度(L)にCLAHE' }] };
        const merged = s.t(new cv.MatVector());
        merged.push_back(L2); merged.push_back(A); merged.push_back(B);
        const lab2 = s.t(new cv.Mat());
        cv.merge(merged, lab2);
        const out = new cv.Mat();
        cv.cvtColor(lab2, out, cv.COLOR_Lab2RGB);
        return { output: out, info: [{ label: 'パイプライン', value: 'Lab分解 → L にCLAHE → 合成' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-unsharp-mask': {
    defaultSample: 'document',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① ぼかし(マスク)', value: 'blur' },
          { label: '② シャープ化 (完成)', value: 'final' },
        ],
      },
      { id: 'k', label: 'ぼかし半径', type: 'slider', min: 1, max: 21, step: 2, default: 7 },
      { id: 'amount', label: '強さ', type: 'slider', min: 0, max: 3, step: 0.1, default: 1 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        const blur = s.t(new cv.Mat());
        const k = odd(num(p.k, 7));
        cv.GaussianBlur(rgb, blur, new cv.Size(k, k), 0);
        if (stage === 'blur') return { output: blur.clone(), info: [{ label: 'ステップ', value: '① ぼかし画像(マスク)' }] };
        const a = num(p.amount, 1);
        const out = new cv.Mat();
        cv.addWeighted(rgb, 1 + a, blur, -a, 0, out);
        return { output: out, info: [{ label: 'パイプライン', value: 'src*(1+a) − blur*a' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-skeletonize': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 二値化', value: 'binary' },
          { label: '② スケルトン (完成)', value: 'final' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        if (stage === 'binary') return { output: bin.clone(), info: [{ label: 'ステップ', value: '① 反転Otsu二値化' }] };
        // Morphological skeleton: accumulate (work − open(work)) while eroding.
        const skel = new cv.Mat(bin.rows, bin.cols, cv.CV_8UC1, new cv.Scalar(0));
        const work = s.t(bin.clone());
        const temp = s.t(new cv.Mat());
        const eroded = s.t(new cv.Mat());
        const M = s.t(cv.getStructuringElement(cv.MORPH_CROSS, new cv.Size(3, 3)));
        let iter = 0;
        while (iter++ < 200) {
          cv.morphologyEx(work, temp, cv.MORPH_OPEN, M);
          cv.subtract(work, temp, temp);
          cv.bitwise_or(skel, temp, skel);
          cv.erode(work, eroded, M);
          eroded.copyTo(work);
          if (cv.countNonZero(work) === 0) break;
        }
        return { output: skel, info: [{ label: 'パイプライン', value: '二値化 → 反復(開差分+収縮)で細線化' }, { label: '反復回数', value: `${iter}` }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-distance-centers': {
    defaultSample: 'coins',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 二値化', value: 'binary' },
          { label: '② 距離変換', value: 'dist' },
          { label: '③ 中心抽出 (完成)', value: 'final' },
        ],
      },
      { id: 'ratio', label: 'ピークしきい値 (最大値比)', type: 'slider', min: 0.3, max: 0.9, step: 0.05, default: 0.55 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        if (stage === 'binary') return { output: bin.clone(), info: [{ label: 'ステップ', value: '① Otsu二値化' }] };
        const dist = s.t(new cv.Mat());
        cv.distanceTransform(bin, dist, cv.DIST_L2, 5);
        const dist8 = s.t(new cv.Mat());
        const norm = s.t(new cv.Mat());
        cv.normalize(dist, norm, 0, 255, cv.NORM_MINMAX);
        norm.convertTo(dist8, cv.CV_8U);
        if (stage === 'dist') return { output: dist8.clone(), info: [{ label: 'ステップ', value: '② 距離変換(物体中心ほど明るい)' }] };
        const mm = cv.minMaxLoc(dist);
        const peaks = s.t(new cv.Mat());
        cv.threshold(dist, peaks, num(p.ratio, 0.55) * mm.maxVal, 255, cv.THRESH_BINARY);
        const peaks8 = s.t(new cv.Mat());
        peaks.convertTo(peaks8, cv.CV_8U);
        const labels = s.t(new cv.Mat());
        const stats = s.t(new cv.Mat());
        const cent = s.t(new cv.Mat());
        const n = cv.connectedComponentsWithStats(peaks8, labels, stats, cent, 8, cv.CV_32S);
        const out = src.clone();
        for (let i = 1; i < n; i++) {
          const cx = cent.data64F[i * 2], cy = cent.data64F[i * 2 + 1];
          cv.circle(out, new cv.Point(cx, cy), 9, ACCENT(cv), -1);
          cv.circle(out, new cv.Point(cx, cy), 9, ACCENT2(cv), 2);
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: '二値化 → 距離変換 → ピーク → 重心' },
            { label: '検出中心数', value: `${n - 1}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-ocr-preprocess': {
    defaultSample: 'document',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① エッジ保持平滑', value: 'bilateral' },
          { label: '② 適応的二値化 (完成)', value: 'final' },
        ],
      },
      { id: 'block', label: '適応ブロックサイズ', type: 'slider', min: 3, max: 51, step: 2, default: 21 },
      { id: 'C', label: '定数 C', type: 'slider', min: -20, max: 20, step: 1, default: 10 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        const smooth = s.t(new cv.Mat());
        cv.bilateralFilter(rgb, smooth, 9, 75, 75, cv.BORDER_DEFAULT);
        if (stage === 'bilateral') return { output: smooth.clone(), info: [{ label: 'ステップ', value: '① bilateral(エッジ保持平滑)' }] };
        const gray = s.t(new cv.Mat());
        cv.cvtColor(smooth, gray, cv.COLOR_RGB2GRAY);
        const out = new cv.Mat();
        cv.adaptiveThreshold(gray, out, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, odd(num(p.block, 21)), num(p.C, 10));
        return { output: out, info: [{ label: 'パイプライン', value: 'bilateral → gray → 適応的二値化' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-edge-overlay': {
    defaultSample: 'scene',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① Cannyエッジ', value: 'edges' },
          { label: '② 元画像へ合成 (完成)', value: 'final' },
        ],
      },
      { id: 't1', label: 'Canny 下限', type: 'slider', min: 0, max: 255, step: 1, default: 50 },
      { id: 't2', label: 'Canny 上限', type: 'slider', min: 0, max: 255, step: 1, default: 150 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        const gray = s.t(toGray(cv, src));
        const edges = s.t(new cv.Mat());
        cv.Canny(gray, edges, num(p.t1, 50), num(p.t2, 150), 3, false);
        if (stage === 'edges') return { output: edges.clone(), info: [{ label: 'ステップ', value: '① Cannyエッジ' }] };
        const dil = s.t(new cv.Mat());
        const M = s.t(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2)));
        cv.dilate(edges, dil, M);
        const out = rgb.clone();
        const od = out.data, ed = dil.data;
        const n = rgb.rows * rgb.cols;
        for (let i = 0; i < n; i++) {
          if (ed[i]) { od[i * 3] = 124; od[i * 3 + 1] = 92; od[i * 3 + 2] = 255; }
        }
        return { output: out, info: [{ label: 'パイプライン', value: 'Canny → dilate → 元画像へ色合成' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-coin-circles': {
    defaultSample: 'coins',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① メディアンぼかし', value: 'blur' },
          { label: '② Hough円検出 (完成)', value: 'final' },
        ],
      },
      { id: 'minDist', label: '中心間最小距離', type: 'slider', min: 10, max: 200, step: 1, default: 50 },
      { id: 'param2', label: '検出しきい値', type: 'slider', min: 10, max: 150, step: 1, default: 45 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        cv.medianBlur(gray, gray, 5);
        if (stage === 'blur') return { output: gray.clone(), info: [{ label: 'ステップ', value: '① メディアンぼかしで偽円を抑制' }] };
        const circles = s.t(new cv.Mat());
        cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1, num(p.minDist, 50), 100, num(p.param2, 45), 0, 0);
        const out = src.clone();
        for (let i = 0; i < circles.cols; i++) {
          const x = circles.data32F[i * 3], y = circles.data32F[i * 3 + 1], r = circles.data32F[i * 3 + 2];
          cv.circle(out, new cv.Point(x, y), r, ACCENT2(cv), 3);
          cv.putText(out, `${i + 1}`, new cv.Point(x - 8, y + 8), cv.FONT_HERSHEY_SIMPLEX, 0.9, ACCENT(cv), 2);
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: 'gray → medianBlur → HoughCircles' },
            { label: '検出個数', value: `${circles.cols}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-watershed-separate': {
    defaultSample: 'coins',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① Otsu二値化', value: 'binary' },
          { label: '② 距離変換', value: 'dist' },
          { label: '③ 確実な前景', value: 'fg' },
          { label: '④ Watershed境界 (完成)', value: 'final' },
        ],
      },
      { id: 'fg', label: '前景しきい値', type: 'slider', min: 0.2, max: 0.9, step: 0.05, default: 0.5 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        const M = s.t(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)));
        const opening = s.t(new cv.Mat());
        cv.morphologyEx(bin, opening, cv.MORPH_OPEN, M, new cv.Point(-1, -1), 2);
        if (stage === 'binary') return { output: opening.clone(), info: [{ label: 'ステップ', value: '① Otsu二値化+開処理' }] };
        const sureBg = s.t(new cv.Mat());
        cv.dilate(opening, sureBg, M, new cv.Point(-1, -1), 3);
        const dist = s.t(new cv.Mat());
        cv.distanceTransform(opening, dist, cv.DIST_L2, 5);
        if (stage === 'dist') {
          const d8 = s.t(new cv.Mat());
          const dn = s.t(new cv.Mat());
          cv.normalize(dist, dn, 0, 255, cv.NORM_MINMAX);
          dn.convertTo(d8, cv.CV_8U);
          return { output: d8.clone(), info: [{ label: 'ステップ', value: '② 距離変換(中心ほど明るい)' }] };
        }
        const dm = cv.minMaxLoc(dist);
        const sureFg = s.t(new cv.Mat());
        cv.threshold(dist, sureFg, num(p.fg, 0.5) * dm.maxVal, 255, cv.THRESH_BINARY);
        const sureFg8 = s.t(new cv.Mat());
        sureFg.convertTo(sureFg8, cv.CV_8U);
        if (stage === 'fg') return { output: sureFg8.clone(), info: [{ label: 'ステップ', value: '③ 距離ピーク=確実な前景(マーカー)' }] };
        const unknown = s.t(new cv.Mat());
        cv.subtract(sureBg, sureFg8, unknown);
        const markers = s.t(new cv.Mat());
        const ncc = cv.connectedComponents(sureFg8, markers);
        const one = s.t(new cv.Mat(markers.rows, markers.cols, markers.type(), new cv.Scalar(1)));
        cv.add(markers, one, markers);
        const n = markers.rows * markers.cols;
        const md = markers.data32S, ud = unknown.data;
        for (let i = 0; i < n; i++) if (ud[i] > 0) md[i] = 0;
        cv.watershed(rgb, markers);
        const out = src.clone();
        const od = out.data;
        for (let i = 0; i < n; i++) {
          if (md[i] === -1) { od[i * 4] = 255; od[i * 4 + 1] = 64; od[i * 4 + 2] = 64; }
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: '二値化→距離変換→マーカー→watershed' },
            { label: '分離した領域数', value: `${Math.max(0, ncc - 1)}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-color-replace': {
    defaultSample: 'colored-objects',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 色マスク', value: 'mask' },
          { label: '② 色置換 (完成)', value: 'final' },
        ],
      },
      { id: 'hLow', label: '対象色相 下限', type: 'slider', min: 0, max: 179, step: 1, default: 0 },
      { id: 'hHigh', label: '対象色相 上限', type: 'slider', min: 0, max: 179, step: 1, default: 12 },
      { id: 'shift', label: '色相シフト量', type: 'slider', min: 0, max: 179, step: 1, default: 90 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        const hsv = s.t(new cv.Mat());
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        const low = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [num(p.hLow, 0), 80, 50, 0]));
        const high = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [num(p.hHigh, 12), 255, 255, 255]));
        const mask = s.t(new cv.Mat());
        cv.inRange(hsv, low, high, mask);
        if (stage === 'mask') return { output: mask.clone(), info: [{ label: 'ステップ', value: '① 置換対象の色マスク' }] };
        const ch = s.t(new cv.MatVector());
        cv.split(hsv, ch);
        const H = s.t(ch.get(0)), S = s.t(ch.get(1)), V = s.t(ch.get(2));
        const hd = H.data, md = mask.data, shift = Math.round(num(p.shift, 90));
        for (let i = 0; i < hd.length; i++) if (md[i]) hd[i] = (hd[i] + shift) % 180;
        const merged = s.t(new cv.MatVector());
        merged.push_back(H); merged.push_back(S); merged.push_back(V);
        const hsv2 = s.t(new cv.Mat());
        cv.merge(merged, hsv2);
        const out = new cv.Mat();
        cv.cvtColor(hsv2, out, cv.COLOR_HSV2RGB);
        return { output: out, info: [{ label: 'パイプライン', value: 'HSV → マスク内のHをシフト → RGB' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-background-flatten': {
    defaultSample: 'document',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 推定背景', value: 'bg' },
          { label: '② ムラ補正 (完成)', value: 'final' },
        ],
      },
      { id: 'k', label: '背景推定カーネル', type: 'slider', min: 11, max: 81, step: 2, default: 41 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const k = odd(num(p.k, 41));
        const M = s.t(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(k, k)));
        // Large opening estimates the (bright) background, removing dark text.
        const bg = s.t(new cv.Mat());
        cv.morphologyEx(gray, bg, cv.MORPH_OPEN, M);
        if (stage === 'bg') return { output: bg.clone(), info: [{ label: 'ステップ', value: '① 大カーネル開処理=背景の明るさ分布' }] };
        // Divide normalizes each pixel by its local background → flat illumination.
        const out = new cv.Mat();
        cv.divide(gray, bg, out, 255);
        return { output: out, info: [{ label: 'パイプライン', value: 'gray ÷ 推定背景 × 255' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-text-region': {
    defaultSample: 'document',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 暗部の二値化', value: 'grad' },
          { label: '② 横連結', value: 'closed' },
          { label: '③ テキスト領域 (完成)', value: 'final' },
        ],
      },
      { id: 'closeW', label: '連結カーネル幅', type: 'slider', min: 3, max: 51, step: 2, default: 21 },
      { id: 'minArea', label: '最小領域面積', type: 'slider', min: 0, max: 8000, step: 100, default: 600 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        // Text/dark marks → white. (THRESH_BINARY_INV: dark text becomes foreground.)
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        if (stage === 'grad') return { output: bin.clone(), info: [{ label: 'ステップ', value: '① 暗部(文字)を白く二値化' }] };
        // Wide horizontal close merges characters/marks into text-line blocks.
        const M = s.t(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(odd(num(p.closeW, 21)), 3)));
        const closed = s.t(new cv.Mat());
        cv.morphologyEx(bin, closed, cv.MORPH_CLOSE, M);
        if (stage === 'closed') return { output: closed.clone(), info: [{ label: 'ステップ', value: '② 横長カーネルで行に連結' }] };
        const contours = s.t(new cv.MatVector());
        const hier = s.t(new cv.Mat());
        cv.findContours(closed, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        const out = src.clone();
        const imgArea = src.rows * src.cols;
        let count = 0;
        for (let i = 0; i < contours.size(); i++) {
          const r = cv.boundingRect(contours.get(i));
          const a = r.width * r.height;
          // wide & not the whole-frame background region
          if (a < num(p.minArea, 600) || a > imgArea * 0.35 || r.width < r.height * 1.3) continue;
          cv.rectangle(out, new cv.Point(r.x, r.y), new cv.Point(r.x + r.width, r.y + r.height), ACCENT2(cv), 2);
          count++;
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: '二値化 → 横連結 → 外接矩形' },
            { label: 'テキスト領域数', value: `${count}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-contour-measure': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 二値化', value: 'binary' },
          { label: '② 形状計測 (完成)', value: 'final' },
        ],
      },
      { id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 30000, step: 500, default: 1500 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        if (stage === 'binary') return { output: bin.clone(), info: [{ label: 'ステップ', value: '① 反転Otsu二値化' }] };
        const contours = s.t(new cv.MatVector());
        const hier = s.t(new cv.Mat());
        cv.findContours(bin, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        const out = src.clone();
        let n = 0;
        const GREEN = new cv.Scalar(52, 224, 161, 255);
        const ORANGE = new cv.Scalar(245, 165, 36, 255);
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i);
          const area = cv.contourArea(c);
          if (area < num(p.minArea, 1500)) continue;
          const peri = cv.arcLength(c, true);
          const circ = peri > 0 ? (4 * Math.PI * area) / (peri * peri) : 0; // 1=完全な円
          const isRound = circ > 0.82;
          cv.drawContours(out, contours, i, isRound ? GREEN : ORANGE, 3);
          const r = cv.boundingRect(c);
          cv.putText(out, `${circ.toFixed(2)}`, new cv.Point(r.x, Math.max(18, r.y - 6)),
            cv.FONT_HERSHEY_SIMPLEX, 0.6, ACCENT2(cv), 2);
          n++;
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: '二値化 → 輪郭 → 円形度 4πA/L²' },
            { label: '計測した図形', value: `${n}` },
            { label: '色分け', value: '緑=円形 / 橙=多角形' },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-roi-mosaic': {
    defaultSample: 'scene',
    params: [
      { id: 'rect', label: '対象領域', type: 'rect', default: [0.32, 0.28, 0.4, 0.4] },
      { id: 'block', label: 'モザイクの粗さ', type: 'slider', min: 4, max: 40, step: 2, default: 16 },
      {
        id: 'mode', label: '処理', type: 'select', default: 'mosaic',
        options: [
          { label: 'モザイク', value: 'mosaic' },
          { label: 'ぼかし', value: 'blur' },
          { label: '黒塗り', value: 'black' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const rgb = s.t(toRGB(cv, src));
        const out = rgb.clone();
        const [x, y, w, h] = clampRect(p.rect, src.cols, src.rows);
        const roi = s.t(out.roi(new cv.Rect(x, y, w, h)));
        const mode = str(p.mode, 'mosaic');
        if (mode === 'black') {
          roi.setTo(new cv.Scalar(15, 18, 26));
        } else if (mode === 'blur') {
          cv.GaussianBlur(roi, roi, new cv.Size(31, 31), 0);
        } else {
          const bk = Math.max(2, Math.round(num(p.block, 16)));
          const sw = Math.max(1, Math.round(w / bk)), sh = Math.max(1, Math.round(h / bk));
          const small = s.t(new cv.Mat());
          cv.resize(roi, small, new cv.Size(sw, sh), 0, 0, cv.INTER_LINEAR);
          cv.resize(small, roi, new cv.Size(w, h), 0, 0, cv.INTER_NEAREST);
        }
        return { output: out, info: [{ label: '対象領域', value: `${w}×${h} px` }, { label: '処理', value: mode }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-auto-canny': {
    defaultSample: 'coins',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① ぼかし', value: 'blur' },
          { label: '② 自動Canny (完成)', value: 'final' },
        ],
      },
      { id: 'sigma', label: 'σ (中央値からの幅)', type: 'slider', min: 0.1, max: 0.6, step: 0.05, default: 0.33 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const blur = s.t(new cv.Mat());
        cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0);
        if (stage === 'blur') return { output: blur.clone(), info: [{ label: 'ステップ', value: '① 軽いぼかし' }] };
        // median of pixel values → adaptive thresholds (PyImageSearch auto-canny)
        const d = blur.data;
        const hist = new Array(256).fill(0);
        for (let i = 0; i < d.length; i++) hist[d[i]]++;
        let cum = 0, median = 128;
        const half = d.length / 2;
        for (let v = 0; v < 256; v++) { cum += hist[v]; if (cum >= half) { median = v; break; } }
        const sigma = num(p.sigma, 0.33);
        const lower = Math.max(0, Math.round((1 - sigma) * median));
        const upper = Math.min(255, Math.round((1 + sigma) * median));
        const edges = new cv.Mat();
        cv.Canny(blur, edges, lower, upper);
        return {
          output: edges,
          info: [
            { label: 'パイプライン', value: 'median → Canny(自動しきい値)' },
            { label: '中央値 / 下限 / 上限', value: `${median} / ${lower} / ${upper}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-contrast-stretch': {
    defaultSample: 'low-contrast',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 元画像(グレー)', value: 'original' },
          { label: '② コントラスト伸張 (完成)', value: 'final' },
        ],
      },
      { id: 'clip', label: '外れ値クリップ (%)', type: 'slider', min: 0, max: 10, step: 0.5, default: 2 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        if (stage === 'original') return { output: gray.clone(), info: [{ label: 'ステップ', value: '① 低コントラストのグレー' }] };
        // percentile clip then linear stretch [low,high] → [0,255]
        const d = gray.data;
        const hist = new Array(256).fill(0);
        for (let i = 0; i < d.length; i++) hist[d[i]]++;
        const clipFrac = num(p.clip, 2) / 100;
        const total = d.length;
        let cum = 0, low = 0, high = 255;
        for (let v = 0; v < 256; v++) { cum += hist[v]; if (cum >= total * clipFrac) { low = v; break; } }
        cum = 0;
        for (let v = 255; v >= 0; v--) { cum += hist[v]; if (cum >= total * clipFrac) { high = v; break; } }
        if (high <= low) high = low + 1;
        const alpha = 255 / (high - low);
        const out = new cv.Mat();
        gray.convertTo(out, -1, alpha, -low * alpha);
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: `[${low},${high}] → [0,255] 線形伸張` },
            { label: '傾き α', value: alpha.toFixed(2) },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-color-pop': {
    defaultSample: 'colored-objects',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 残す色のマスク', value: 'mask' },
          { label: '② カラーポップ (完成)', value: 'final' },
        ],
      },
      { id: 'hLow', label: '残す色相 下限', type: 'slider', min: 0, max: 179, step: 1, default: 0 },
      { id: 'hHigh', label: '残す色相 上限', type: 'slider', min: 0, max: 179, step: 1, default: 12 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        const hsv = s.t(new cv.Mat());
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        const low = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [num(p.hLow, 0), 80, 50, 0]));
        const high = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [num(p.hHigh, 12), 255, 255, 255]));
        const mask = s.t(new cv.Mat());
        cv.inRange(hsv, low, high, mask);
        if (stage === 'mask') return { output: mask.clone(), info: [{ label: 'ステップ', value: '① 残す色のマスク' }] };
        const gray = s.t(new cv.Mat());
        cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
        const out = new cv.Mat();
        cv.cvtColor(gray, out, cv.COLOR_GRAY2RGB); // モノクロ背景
        rgb.copyTo(out, mask); // 指定色だけカラーで戻す
        return { output: out, info: [{ label: 'パイプライン', value: '色マスク → 背景グレー化 → 色を戻す' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-gradient-orientation': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 勾配の大きさ', value: 'mag' },
          { label: '② 方向マップ (完成)', value: 'final' },
        ],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const gx = s.t(new cv.Mat()), gy = s.t(new cv.Mat());
        cv.Sobel(gray, gx, cv.CV_32F, 1, 0, 3);
        cv.Sobel(gray, gy, cv.CV_32F, 0, 1, 3);
        const mag = s.t(new cv.Mat()), ang = s.t(new cv.Mat());
        cv.cartToPolar(gx, gy, mag, ang, true);
        const magN = s.t(new cv.Mat());
        cv.normalize(mag, magN, 0, 255, cv.NORM_MINMAX);
        if (stage === 'mag') {
          const m8 = s.t(new cv.Mat());
          magN.convertTo(m8, cv.CV_8U);
          return { output: m8.clone(), info: [{ label: 'ステップ', value: '① 勾配の大きさ(エッジ強度)' }] };
        }
        const n = gray.rows * gray.cols;
        const hsv = s.t(new cv.Mat(gray.rows, gray.cols, cv.CV_8UC3));
        const hd = hsv.data, md = magN.data32F, ad = ang.data32F;
        for (let i = 0; i < n; i++) {
          hd[i * 3] = Math.round(ad[i] / 2) % 180; // 色相=方向
          hd[i * 3 + 1] = 255;
          hd[i * 3 + 2] = Math.min(255, md[i]); // 明度=強度
        }
        const out = new cv.Mat();
        cv.cvtColor(hsv, out, cv.COLOR_HSV2RGB);
        return { output: out, info: [{ label: 'パイプライン', value: 'Sobel x,y → cartToPolar → HSV' }, { label: '色', value: '色相=エッジの向き / 明度=強さ' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-binary-cleanup': {
    defaultSample: 'noisy',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 生の二値化', value: 'raw' },
          { label: '② 開処理(点除去)', value: 'opened' },
          { label: '③ 閉処理(穴埋め, 完成)', value: 'final' },
        ],
      },
      { id: 'k', label: 'カーネルサイズ', type: 'slider', min: 1, max: 15, step: 2, default: 3 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
        if (stage === 'raw') return { output: bin.clone(), info: [{ label: 'ステップ', value: '① 生の二値化(ノイズだらけ)' }] };
        const k = odd(num(p.k, 3));
        const M = s.t(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(k, k)));
        const opened = s.t(new cv.Mat());
        cv.morphologyEx(bin, opened, cv.MORPH_OPEN, M);
        if (stage === 'opened') return { output: opened.clone(), info: [{ label: 'ステップ', value: '② 開処理で孤立点を除去' }] };
        const out = new cv.Mat();
        cv.morphologyEx(opened, out, cv.MORPH_CLOSE, M);
        return { output: out, info: [{ label: 'パイプライン', value: '二値化 → 開(点除去) → 閉(穴埋め)' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-size-sort': {
    defaultSample: 'coins',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 二値化', value: 'binary' },
          { label: '② 大きさで仕分け (完成)', value: 'final' },
        ],
      },
      { id: 'thresh', label: '大小の境界面積', type: 'slider', min: 1000, max: 25000, step: 500, default: 12000 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        const bin = s.t(new cv.Mat());
        cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
        const M = s.t(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5)));
        cv.morphologyEx(bin, bin, cv.MORPH_OPEN, M);
        if (stage === 'binary') return { output: bin.clone(), info: [{ label: 'ステップ', value: '① Otsu二値化+開' }] };
        const contours = s.t(new cv.MatVector());
        const hier = s.t(new cv.Mat());
        cv.findContours(bin, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        const out = src.clone();
        const GREEN = new cv.Scalar(52, 224, 161, 255), ORANGE = new cv.Scalar(245, 165, 36, 255);
        const boundary = num(p.thresh, 12000);
        let small = 0, large = 0;
        for (let i = 0; i < contours.size(); i++) {
          const area = cv.contourArea(contours.get(i));
          if (area < 300) continue;
          const big = area >= boundary;
          cv.drawContours(out, contours, i, big ? ORANGE : GREEN, -1);
          if (big) large++; else small++;
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: '二値化 → 輪郭 → 面積で分類' },
            { label: '大(橙) / 小(緑)', value: `${large} / ${small}` },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-count-by-color': {
    defaultSample: 'colored-objects',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 全色マスク', value: 'mask' },
          { label: '② 色別カウント (完成)', value: 'final' },
        ],
      },
      { id: 'sMin', label: '彩度しきい値', type: 'slider', min: 20, max: 200, step: 5, default: 80 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        const hsv = s.t(new cv.Mat());
        cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);
        const sMin = num(p.sMin, 80);
        const bands: { name: string; lo: number; hi: number; col: [number, number, number] }[] = [
          { name: '赤', lo: 0, hi: 12, col: [255, 77, 109] },
          { name: '黄', lo: 20, hi: 40, col: [245, 196, 15] },
          { name: '緑', lo: 41, hi: 85, col: [52, 224, 161] },
          { name: '青', lo: 95, hi: 130, col: [52, 152, 219] },
          { name: '紫', lo: 131, hi: 160, col: [155, 89, 182] },
        ];
        const out = stage === 'final' ? src.clone() : new cv.Mat(src.rows, src.cols, cv.CV_8UC3, new cv.Scalar(15, 18, 26));
        const counts: string[] = [];
        for (const b of bands) {
          const low = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [b.lo, sMin, 40, 0]));
          const high = s.t(new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [b.hi, 255, 255, 255]));
          const mask = s.t(new cv.Mat());
          cv.inRange(hsv, low, high, mask);
          const cont = s.t(new cv.MatVector());
          const hier = s.t(new cv.Mat());
          cv.findContours(mask, cont, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
          let c = 0;
          for (let i = 0; i < cont.size(); i++) {
            if (cv.contourArea(cont.get(i)) < 500) continue;
            if (stage === 'final') cv.drawContours(out, cont, i, new cv.Scalar(b.col[0], b.col[1], b.col[2], 255), 4);
            else cv.drawContours(out, cont, i, new cv.Scalar(b.col[0], b.col[1], b.col[2]), -1);
            c++;
          }
          if (c > 0) counts.push(`${b.name}:${c}`);
        }
        return {
          output: out,
          info: [
            { label: 'パイプライン', value: '色帯ごとに inRange → 輪郭 → 計数' },
            { label: '色別個数', value: counts.join('  ') || '0' },
          ],
        };
      } finally {
        s.done();
      }
    },
  },

  'recipe-pseudocolor': {
    defaultSample: 'dark',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① グレースケール', value: 'gray' },
          { label: '② 疑似カラー (完成)', value: 'final' },
        ],
      },
      {
        id: 'map', label: 'カラーマップ', type: 'select', default: 'jet',
        options: [{ label: 'JET (青→赤)', value: 'jet' }, { label: 'HOT (黒→白熱)', value: 'hot' }],
      },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const gray = s.t(toGray(cv, src));
        if (stage === 'gray') return { output: gray.clone(), info: [{ label: 'ステップ', value: '① グレースケール(輝度)' }] };
        const out = new cv.Mat(gray.rows, gray.cols, cv.CV_8UC3);
        const gd = gray.data, od = out.data;
        const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)));
        const map = str(p.map, 'jet');
        for (let i = 0; i < gd.length; i++) {
          const t = gd[i] / 255;
          if (map === 'hot') {
            od[i * 3] = clamp(3 * t); od[i * 3 + 1] = clamp(3 * t - 1); od[i * 3 + 2] = clamp(3 * t - 2);
          } else {
            od[i * 3] = clamp(1.5 - Math.abs(4 * t - 3));
            od[i * 3 + 1] = clamp(1.5 - Math.abs(4 * t - 2));
            od[i * 3 + 2] = clamp(1.5 - Math.abs(4 * t - 1));
          }
        }
        return { output: out, info: [{ label: 'パイプライン', value: '輝度 → カラーマップLUT' }, { label: 'マップ', value: map.toUpperCase() }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-glow-bloom': {
    defaultSample: 'scene',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 明部の抽出', value: 'bright' },
          { label: '② グロー合成 (完成)', value: 'final' },
        ],
      },
      { id: 'thresh', label: '明部しきい値', type: 'slider', min: 100, max: 255, step: 5, default: 180 },
      { id: 'strength', label: 'グローの強さ', type: 'slider', min: 0, max: 2, step: 0.1, default: 0.8 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        const gray = s.t(toGray(cv, src));
        const brightMask = s.t(new cv.Mat());
        cv.threshold(gray, brightMask, num(p.thresh, 180), 255, cv.THRESH_BINARY);
        const bright = s.t(new cv.Mat());
        cv.bitwise_and(rgb, rgb, bright, brightMask);
        if (stage === 'bright') return { output: bright.clone(), info: [{ label: 'ステップ', value: '① 明るい部分だけ抽出' }] };
        const glow = s.t(new cv.Mat());
        cv.GaussianBlur(bright, glow, new cv.Size(31, 31), 0);
        const out = new cv.Mat();
        cv.addWeighted(rgb, 1, glow, num(p.strength, 0.8), 0, out);
        return { output: out, info: [{ label: 'パイプライン', value: '明部抽出 → ぼかし → 加算合成' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-vignette': {
    defaultSample: 'scene',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 元画像', value: 'original' },
          { label: '② ビネット (完成)', value: 'final' },
        ],
      },
      { id: 'strength', label: '減光の強さ', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.75 },
      { id: 'radius', label: '効果開始の半径', type: 'slider', min: 0.1, max: 0.9, step: 0.05, default: 0.55 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'final');
        const rgb = s.t(toRGB(cv, src));
        if (stage === 'original') return { output: rgb.clone(), info: [{ label: 'ステップ', value: '① 元画像' }] };
        const out = rgb.clone();
        const od = out.data;
        const cols = out.cols, rows = out.rows;
        const cx = cols / 2, cy = rows / 2, maxD = Math.hypot(cx, cy);
        const strength = num(p.strength, 0.75), radius = num(p.radius, 0.55);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const d = Math.hypot(x - cx, y - cy) / maxD;
            let f = 1 - strength * Math.max(0, (d - radius) / (1 - radius));
            if (f < 0) f = 0;
            const i = (y * cols + x) * 3;
            od[i] = Math.round(od[i] * f); od[i + 1] = Math.round(od[i + 1] * f); od[i + 2] = Math.round(od[i + 2] * f);
          }
        }
        return { output: out, info: [{ label: 'パイプライン', value: '中心からの距離で減光マスクを乗算' }] };
      } finally {
        s.done();
      }
    },
  },

  'recipe-motion-blur': {
    defaultSample: 'shapes',
    params: [
      {
        id: 'stage', label: '表示ステップ', type: 'select', default: 'final',
        options: [
          { label: '① 元画像', value: 'original' },
          { label: '② 方向ブラー (完成)', value: 'final' },
        ],
      },
      { id: 'length', label: 'ブレの長さ', type: 'slider', min: 3, max: 41, step: 2, default: 15 },
      { id: 'angle', label: 'ブレの角度 (°)', type: 'slider', min: 0, max: 180, step: 5, default: 0 },
    ],
    run: (cv, src, p) => {
      const s = new Scope();
      try {
        const stage = str(p.stage, 'original');
        const rgb = s.t(toRGB(cv, src));
        if (stage === 'original') return { output: rgb.clone(), info: [{ label: 'ステップ', value: '① 元画像' }] };
        const L = odd(num(p.length, 15));
        const ang = (num(p.angle, 0) * Math.PI) / 180;
        // line kernel of length L at the given angle, normalized
        const kdata = new Array(L * L).fill(0);
        const c = (L - 1) / 2;
        const dx = Math.cos(ang), dy = Math.sin(ang);
        let cnt = 0;
        for (let t = -(L - 1) / 2; t <= (L - 1) / 2; t++) {
          const xx = Math.round(c + dx * t), yy = Math.round(c + dy * t);
          if (xx >= 0 && xx < L && yy >= 0 && yy < L && kdata[yy * L + xx] === 0) { kdata[yy * L + xx] = 1; cnt++; }
        }
        for (let i = 0; i < kdata.length; i++) kdata[i] /= cnt;
        const kernel = s.t(cv.matFromArray(L, L, cv.CV_32F, kdata));
        const out = new cv.Mat();
        cv.filter2D(rgb, out, -1, kernel);
        return { output: out, info: [{ label: 'パイプライン', value: '線状カーネル → filter2D' }, { label: '方向', value: `${Math.round(num(p.angle, 0))}° / 長さ${L}` }] };
      } finally {
        s.done();
      }
    },
  },
};

/** Build a morphology demo impl (erosion/dilation/opening/closing). */
function morph(id: 'erosion' | 'dilation' | 'opening' | 'closing', sample: string): Record<string, DemoImpl> {
  return {
    [id]: {
      defaultSample: sample,
      params: [
        { id: 'k', label: 'カーネルサイズ', type: 'slider', min: 1, max: 25, step: 2, default: 5 },
        ...(id === 'erosion' || id === 'dilation'
          ? [{ id: 'iter', label: '反復回数', type: 'slider' as const, min: 1, max: 8, step: 1, default: 1 }]
          : []),
      ],
      run: (cv, src, p) => {
        const s = new Scope();
        try {
          const gray = s.t(toGray(cv, src));
          const bin = s.t(new cv.Mat());
          cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
          const k = odd(num(p.k, 5));
          const M = s.t(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(k, k)));
          const out = new cv.Mat();
          const anchor = new cv.Point(-1, -1);
          if (id === 'erosion') cv.erode(bin, out, M, anchor, num(p.iter, 1));
          else if (id === 'dilation') cv.dilate(bin, out, M, anchor, num(p.iter, 1));
          else if (id === 'opening') cv.morphologyEx(bin, out, cv.MORPH_OPEN, M);
          else cv.morphologyEx(bin, out, cv.MORPH_CLOSE, M);
          return { output: out };
        } finally {
          s.done();
        }
      },
    },
  };
}

export function getImpl(id: string): DemoImpl | undefined {
  return impls[id];
}

export function isImplemented(id: string): boolean {
  return id in impls;
}

export const implementedCount = Object.keys(impls).length;
