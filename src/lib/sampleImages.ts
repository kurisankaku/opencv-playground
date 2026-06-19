/**
 * Procedurally-generated sample images.
 *
 * Instead of shipping binary photos, we draw samples on a canvas at runtime.
 * This keeps the app fully self-contained/offline and — crucially — gives each
 * demo an input that shows its effect clearly (e.g. distinct color blobs for
 * inRange, clean circles for Hough, salt-and-pepper for median blur).
 * Users can always upload their own photo instead.
 */

export interface SampleImage {
  id: string;
  label: string;
  hint: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

const W = 720;
const H = 540;

function bg(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

function addNoise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, salt = 0) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (salt > 0 && Math.random() < salt) {
      const v = Math.random() < 0.5 ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      continue;
    }
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

export const sampleImages: SampleImage[] = [
  {
    id: 'shapes',
    label: '図形',
    hint: '輪郭・二値化・エッジ向き',
    draw: (ctx, w, h) => {
      bg(ctx, w, h, '#f4f5f7');
      const shapes: Array<[string, () => void]> = [
        ['#7c5cff', () => ctx.fillRect(60, 70, 160, 160)],
        [
          '#22d3ee',
          () => {
            ctx.beginPath();
            ctx.arc(360, 150, 90, 0, Math.PI * 2);
            ctx.fill();
          },
        ],
        [
          '#ff4d6d',
          () => {
            ctx.beginPath();
            ctx.moveTo(560, 60);
            ctx.lineTo(660, 230);
            ctx.lineTo(460, 230);
            ctx.closePath();
            ctx.fill();
          },
        ],
        [
          '#34e0a1',
          () => {
            ctx.beginPath();
            const cx = 180,
              cy = 400,
              r = 95;
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
              ctx[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
            }
            ctx.closePath();
            ctx.fill();
          },
        ],
        [
          '#f5a524',
          () => {
            ctx.beginPath();
            ctx.ellipse(440, 410, 120, 70, 0, 0, Math.PI * 2);
            ctx.fill();
          },
        ],
      ];
      for (const [color, fn] of shapes) {
        ctx.fillStyle = color;
        fn();
      }
      ctx.strokeStyle = '#0a0c12';
      ctx.lineWidth = 4;
      ctx.strokeRect(600, 360, 80, 130);
    },
  },
  {
    id: 'coins',
    label: 'コイン',
    hint: 'Hough円・最小外接円向き',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#2a2f3a');
      grad.addColorStop(1, '#1c2029');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      const coins: Array<[number, number, number]> = [
        [150, 150, 70],
        [330, 120, 55],
        [520, 170, 80],
        [220, 360, 60],
        [430, 380, 48],
        [610, 360, 66],
      ];
      for (const [x, y, r] of coins) {
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
        g.addColorStop(0, '#f0d98c');
        g.addColorStop(1, '#b8923f');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8a6a2c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, r - 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  },
  {
    id: 'colored-objects',
    label: '色付き物体',
    hint: '色抽出(HSV/inRange)・マスク向き',
    draw: (ctx, w, h) => {
      bg(ctx, w, h, '#e9ebf0');
      const blobs: Array<[string, number, number, number]> = [
        ['#e23030', 170, 160, 90],
        ['#27ae60', 400, 130, 75],
        ['#2d7dd2', 560, 300, 85],
        ['#f2c400', 240, 380, 80],
        ['#9b59b6', 470, 410, 60],
      ];
      for (const [color, x, y, r] of blobs) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 'lines',
    label: '直線',
    hint: 'Hough直線・エッジ向き',
    draw: (ctx, w, h) => {
      bg(ctx, w, h, '#f4f5f7');
      ctx.strokeStyle = '#11141c';
      ctx.lineWidth = 3;
      const segs: Array<[number, number, number, number]> = [
        [40, 60, 680, 90],
        [60, 480, 660, 360],
        [120, 40, 300, 500],
        [600, 40, 420, 500],
        [40, 270, 680, 270],
        [360, 30, 360, 510],
      ];
      for (const [x1, y1, x2, y2] of segs) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    },
  },
  {
    id: 'scene',
    label: '風景(合成)',
    hint: 'ぼかし・ヒスト・シャープ向き',
    draw: (ctx, w, h) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#5b6cff');
      sky.addColorStop(0.5, '#a06bff');
      sky.addColorStop(1, '#ff7eb6');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      // sun
      const sun = ctx.createRadialGradient(540, 150, 10, 540, 150, 110);
      sun.addColorStop(0, 'rgba(255,247,200,0.95)');
      sun.addColorStop(1, 'rgba(255,247,200,0)');
      ctx.fillStyle = sun;
      ctx.beginPath();
      ctx.arc(540, 150, 110, 0, Math.PI * 2);
      ctx.fill();
      // hills
      ctx.fillStyle = '#2b2052';
      ctx.beginPath();
      ctx.moveTo(0, 420);
      ctx.quadraticCurveTo(200, 320, 420, 410);
      ctx.quadraticCurveTo(600, 470, 720, 400);
      ctx.lineTo(720, 540);
      ctx.lineTo(0, 540);
      ctx.fill();
      ctx.fillStyle = '#170f33';
      ctx.beginPath();
      ctx.moveTo(0, 470);
      ctx.quadraticCurveTo(260, 410, 480, 480);
      ctx.quadraticCurveTo(620, 520, 720, 470);
      ctx.lineTo(720, 540);
      ctx.lineTo(0, 540);
      ctx.fill();
    },
  },
  {
    id: 'noisy',
    label: 'ノイズ入り',
    hint: 'メディアン/ガウシアン除去向き',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#c4cad6');
      grad.addColorStop(1, '#8b93a6');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2b3142';
      ctx.font = 'bold 120px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CV', w / 2, h / 2 + 40);
      addNoise(ctx, w, h, 90, 0.06);
    },
  },
  {
    id: 'document',
    label: '書類',
    hint: '二値化・適応的・透視変換向き',
    draw: (ctx, w, h) => {
      bg(ctx, w, h, '#20242e');
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((-7 * Math.PI) / 180);
      // page with uneven lighting
      const page = ctx.createLinearGradient(-220, 0, 220, 0);
      page.addColorStop(0, '#fbfbf7');
      page.addColorStop(1, '#d7d8cf');
      ctx.fillStyle = page;
      ctx.fillRect(-220, -260, 440, 520);
      ctx.fillStyle = '#1c1f27';
      ctx.fillRect(-170, -210, 260, 26); // title
      ctx.fillStyle = '#5a5f6b';
      for (let i = 0; i < 12; i++) {
        const yy = -150 + i * 30;
        const lw = i % 4 === 3 ? 150 : 340;
        ctx.fillRect(-170, yy, lw, 12);
      }
      ctx.restore();
    },
  },
  {
    id: 'dark',
    label: '暗い画像',
    hint: '明るさ・ヒスト均一化向き',
    draw: (ctx, w, h) => {
      const grad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 420);
      grad.addColorStop(0, '#34303f');
      grad.addColorStop(1, '#0c0a12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#46414f';
      ctx.beginPath();
      ctx.arc(260, 230, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3b3a44';
      ctx.fillRect(420, 280, 150, 150);
    },
  },
  {
    id: 'low-contrast',
    label: '低コントラスト',
    hint: 'コントラスト・CLAHE向き',
    draw: (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#8f96a3');
      grad.addColorStop(1, '#a7adb8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#9aa0ac';
      ctx.beginPath();
      ctx.arc(300, 260, 110, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#969ca8';
      ctx.font = 'bold 90px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOW', 480, 300);
    },
  },
];

const cache = new Map<string, HTMLCanvasElement>();

/** Render (and cache) a sample image to a canvas. */
export function renderSample(id: string, w = W, h = H): HTMLCanvasElement {
  const cached = cache.get(id);
  if (cached) return cached;
  const sample = sampleImages.find((s) => s.id === id) ?? sampleImages[0];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  sample.draw(ctx, w, h);
  cache.set(id, canvas);
  return canvas;
}

export function sampleDataUrl(id: string): string {
  return renderSample(id).toDataURL('image/png');
}
