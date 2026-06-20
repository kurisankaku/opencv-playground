import { useRef } from 'react';
import type { RuntimeParam } from '../lib/processors';

/**
 * Interactive overlay for spatial ('points' / 'rect') params. Renders an SVG in
 * IMAGE coordinate space (viewBox = image size) on top of the input preview, so
 * handle positions map 1:1 to the pixel coordinates the worker receives. The
 * container has the image's aspect ratio (no letterboxing), so pointer→image
 * mapping is a simple ratio.
 */
export function SpatialEditor({
  imgW,
  imgH,
  param,
  value,
  onChange,
}: {
  imgW: number;
  imgH: number;
  param: RuntimeParam;
  value: any;
  onChange: (v: any) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: 'point' | 'rect'; idx?: number; startX?: number; startY?: number } | null>(null);

  const toImg = (e: React.PointerEvent): [number, number] => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * imgW;
    const y = ((e.clientY - r.top) / r.height) * imgH;
    return [Math.max(0, Math.min(imgW, x)), Math.max(0, Math.min(imgH, y))];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const [ix, iy] = toImg(e);
    svgRef.current?.setPointerCapture?.(e.pointerId);
    if (param.type === 'points') {
      const pts = (value as number[][]) ?? [];
      let best = -1;
      let bestD = Infinity;
      pts.forEach((pt, i) => {
        const d = Math.hypot(pt[0] - ix, pt[1] - iy);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0 && bestD < imgW / 6) {
        drag.current = { kind: 'point', idx: best };
        update(best, ix, iy);
      }
    } else {
      drag.current = { kind: 'rect', startX: ix, startY: iy };
      onChange([Math.round(ix), Math.round(iy), 0, 0]);
    }
  };

  const update = (idx: number, ix: number, iy: number) => {
    const pts = ((value as number[][]) ?? []).map((p) => [...p]);
    pts[idx] = [Math.round(ix), Math.round(iy)];
    onChange(pts);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const [ix, iy] = toImg(e);
    if (drag.current.kind === 'point') {
      update(drag.current.idx!, ix, iy);
    } else {
      const sx = drag.current.startX!;
      const sy = drag.current.startY!;
      onChange([
        Math.round(Math.min(sx, ix)),
        Math.round(Math.min(sy, iy)),
        Math.round(Math.abs(ix - sx)),
        Math.round(Math.abs(iy - sy)),
      ]);
    }
  };

  const onPointerUp = () => { drag.current = null; };

  const r = imgW / 55; // handle radius in image units
  const sw = imgW / 320; // stroke width in image units

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${imgW} ${imgH}`}
      preserveAspectRatio="none"
      className={`absolute inset-0 h-full w-full ${param.type === 'rect' ? 'cursor-crosshair' : 'cursor-grab'}`}
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {param.type === 'points' ? (
        <PointsOverlay pts={(value as number[][]) ?? []} labels={param.pointLabels} r={r} sw={sw} imgW={imgW} />
      ) : (
        <RectOverlay rect={(value as number[]) ?? [0, 0, 0, 0]} r={r} sw={sw} />
      )}
    </svg>
  );
}

function PointsOverlay({ pts, labels, r, sw, imgW }: { pts: number[][]; labels?: string[]; r: number; sw: number; imgW: number }) {
  return (
    <>
      {pts.length >= 2 && (
        <polygon
          points={pts.map((p) => `${p[0]},${p[1]}`).join(' ')}
          fill="rgba(124,92,255,0.12)"
          stroke="rgba(124,92,255,0.7)"
          strokeWidth={sw}
        />
      )}
      {pts.map((pt, i) => (
        <g key={i}>
          <circle cx={pt[0]} cy={pt[1]} r={r} fill="#22d3ee" stroke="#06070b" strokeWidth={sw} />
          <circle cx={pt[0]} cy={pt[1]} r={r / 3} fill="#06070b" />
          {labels?.[i] && (
            <text
              x={pt[0]}
              y={pt[1] - r * 1.6}
              fill="#e6e8ee"
              fontSize={imgW / 32}
              textAnchor="middle"
              style={{ paintOrder: 'stroke', stroke: '#06070b', strokeWidth: sw * 2 }}
            >
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </>
  );
}

function RectOverlay({ rect, r, sw }: { rect: number[]; r: number; sw: number }) {
  const [x, y, w, h] = rect;
  const corners: [number, number][] = [
    [x, y], [x + w, y], [x + w, y + h], [x, y + h],
  ];
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill="rgba(34,211,238,0.14)" stroke="#22d3ee" strokeWidth={sw} />
      {w > 0 && h > 0 && corners.map((c, i) => (
        <circle key={i} cx={c[0]} cy={c[1]} r={r * 0.7} fill="#22d3ee" stroke="#06070b" strokeWidth={sw} />
      ))}
    </>
  );
}
