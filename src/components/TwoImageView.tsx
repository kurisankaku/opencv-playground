import type { RefObject } from 'react';
import type { ChartData } from '../lib/chartTypes';
import { HistogramChart } from './HistogramChart';

/**
 * Preview for two-image demos: small thumbnails of inputs A and B on top, and
 * the combined output (image or chart) below. The run() composes whatever
 * visualization it needs into a single output, so the output area is generic.
 */
export function TwoImageView({
  aRef,
  bRef,
  outRef,
  aspectA,
  aspectB,
  isChart = false,
  chart = null,
  busy = false,
}: {
  aRef: RefObject<HTMLCanvasElement>;
  bRef: RefObject<HTMLCanvasElement>;
  outRef: RefObject<HTMLCanvasElement>;
  aspectA: number;
  aspectB: number;
  isChart?: boolean;
  chart?: ChartData | null;
  busy?: boolean;
}) {
  const box = 'relative overflow-hidden rounded-xl border border-line bg-[#06070b]';
  return (
    <div className="space-y-3" data-testid="two-image-preview">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="eyebrow">入力 A</p>
          <div className={box} style={{ aspectRatio: String(aspectA || 4 / 3) }}>
            <canvas ref={aRef} className="absolute inset-0 h-full w-full object-contain" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="eyebrow">入力 B</p>
          <div className={box} style={{ aspectRatio: String(aspectB || 4 / 3) }}>
            <canvas ref={bRef} className="absolute inset-0 h-full w-full object-contain" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="eyebrow">出力</p>
        {isChart ? (
          <HistogramChart data={chart} busy={busy} />
        ) : (
          <div className={`${box} grid place-items-center p-1`}>
            {/* No fixed aspect: wide side-by-side composites display at their
                natural ratio (capped by height), narrow ones fill the width. */}
            <canvas ref={outRef} className="mx-auto block max-h-[46vh] max-w-full" />
            {busy && (
              <div className="absolute inset-0 overflow-hidden">
                <div className="animate-scan absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cyan/15 to-transparent" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
