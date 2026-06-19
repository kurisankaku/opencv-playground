import type { Cv } from '../types/opencv';
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
  output: any; // cv.Mat — caller owns + deletes
  info?: InfoItem[];
}

export interface DemoImpl {
  defaultSample: string;
  params: RuntimeParam[];
  run: (cv: Cv, src: any, p: Record<string, any>) => RunResult;
}

const num = (v: any, d: number) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);
const str = (v: any, d: string) => (typeof v === 'string' ? v : d);
const ACCENT = (cv: Cv) => new cv.Scalar(124, 92, 255, 255);
const ACCENT2 = (cv: Cv) => new cv.Scalar(34, 211, 238, 255);

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
      const scale = num(p.scale, 0.4);
      const map: Record<string, number> = {
        nearest: cv.INTER_NEAREST,
        linear: cv.INTER_LINEAR,
        area: cv.INTER_AREA,
        cubic: cv.INTER_CUBIC,
      };
      const out = new cv.Mat();
      const w = Math.max(1, Math.round(src.cols * scale));
      const h = Math.max(1, Math.round(src.rows * scale));
      cv.resize(src, out, new cv.Size(w, h), 0, 0, map[str(p.interp, 'area')]);
      return { output: out, info: [{ label: '出力サイズ', value: `${w} × ${h} px` }] };
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
    defaultSample: 'scene',
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
    defaultSample: 'shapes',
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
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 5000, step: 50, default: 200 }],
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
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 5000, step: 50, default: 200 }],
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
    params: [{ id: 'minArea', label: '最小面積', type: 'slider', min: 0, max: 5000, step: 50, default: 200 }],
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
