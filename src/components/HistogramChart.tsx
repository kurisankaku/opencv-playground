import type { ChartData } from '../lib/chartTypes';

/**
 * Renders a `chart`-output demo result (currently histograms) as a crisp SVG.
 * The heavy lifting (cv.calcHist) happens in the worker; this just draws the
 * returned bin counts — one filled poly-line per channel series.
 */
export function HistogramChart({ data, busy = false }: { data: ChartData | null; busy?: boolean }) {
  if (!data || data.series.length === 0) {
    return (
      <div className="panel grid h-52 place-items-center text-sm text-fg-dim">
        {busy ? 'ヒストグラムを計算中…' : 'ヒストグラムがありません。'}
      </div>
    );
  }

  const W = 600;
  const H = 240;
  const padL = 30;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const bins = data.bins;
  const max = Math.max(1, ...data.series.flatMap((s) => s.values));

  const x = (i: number) => padL + (bins <= 1 ? 0 : (i / (bins - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const baseline = padT + plotH;

  return (
    <div className="panel p-3">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ aspectRatio: `${W} / ${H}` }}>
          {/* horizontal gridlines */}
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={padL} y1={padT + plotH * g} x2={padL + plotW} y2={padT + plotH * g} stroke="#1c2029" strokeWidth={1} />
          ))}
          {/* axes */}
          <line x1={padL} y1={baseline} x2={padL + plotW} y2={baseline} stroke="#2a2f3a" strokeWidth={1} />
          <line x1={padL} y1={padT} x2={padL} y2={baseline} stroke="#2a2f3a" strokeWidth={1} />

          {data.series.map((s) => {
            const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
            const area = `${padL.toFixed(1)},${baseline} ${pts} ${(padL + plotW).toFixed(1)},${baseline}`;
            return (
              <g key={s.label}>
                <polygon points={area} fill={s.color} opacity={data.series.length > 1 ? 0.22 : 0.35} />
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth={1.6} strokeLinejoin="round" />
              </g>
            );
          })}

          {/* x-axis end labels (pixel value range) */}
          <text x={padL} y={H - 8} fill="#8b93a6" fontSize={11} fontFamily="monospace">0</text>
          <text x={padL + plotW} y={H - 8} fill="#8b93a6" fontSize={11} fontFamily="monospace" textAnchor="end">
            {data.range}
          </text>
        </svg>
        {busy && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center rounded bg-ink/30 text-xs text-cyan">
            更新中…
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {data.series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-fg-dim">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        {data.xLabel && <span className="ml-auto font-mono text-[10px] text-fg-dim">x: {data.xLabel}</span>}
      </div>
    </div>
  );
}
