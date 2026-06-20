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
  type: 'slider' | 'select' | 'toggle';
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  options?: { label: string; value: string }[];
  hint?: string;
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

export interface DemoImpl {
  defaultSample: string;
  /** Preview kind. 'image' (default) shows the before/after view; 'chart' shows a chart. */
  output?: 'image' | 'chart';
  params: RuntimeParam[];
  run: (cv: Cv, src: any, p: Record<string, any>) => RunResult;
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
