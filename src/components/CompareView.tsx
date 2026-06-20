import { useRef, useState, type RefObject } from 'react';

/**
 * Before/After comparison with a draggable split.
 * Both canvases are drawn at full size (object-contain); the "after" canvas is
 * revealed on the left via clip-path inset driven by the handle position.
 */
export function CompareView({
  beforeRef,
  afterRef,
  aspect,
  busy = false,
  className = '',
}: {
  beforeRef: RefObject<HTMLCanvasElement>;
  afterRef: RefObject<HTMLCanvasElement>;
  aspect: number;
  busy?: boolean;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(50);
  const dragging = useRef(false);

  const setFromClientX = (clientX: number) => {
    const el = container.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(0, Math.min(100, pct)));
  };

  return (
    <div
      ref={container}
      data-testid="compare"
      className={`relative w-full select-none overflow-hidden rounded-xl border border-line bg-[#06070b] ${className}`}
      style={{ aspectRatio: String(aspect || 4 / 3), touchAction: 'none' }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => (dragging.current = false)}
    >
      {/* checkerboard so transparent regions read clearly */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(45deg,#fff 25%,transparent 25%),linear-gradient(-45deg,#fff 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#fff 75%),linear-gradient(-45deg,transparent 75%,#fff 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
        }}
      />
      <canvas ref={beforeRef} className="absolute inset-0 h-full w-full object-contain" />
      <canvas
        ref={afterRef}
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
      />

      {/* labels */}
      <span className="eyebrow absolute right-3 top-3 rounded bg-ink/70 px-2 py-1 backdrop-blur">変換後 (After)</span>
      <span className="eyebrow absolute left-3 bottom-3 rounded bg-ink/70 px-2 py-1 backdrop-blur">元画像 (Before)</span>

      {/* split handle */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-gradient-to-b from-violet to-cyan" />
        <div className="absolute top-1/2 -ml-4 -mt-4 grid h-8 w-8 -translate-y-0 place-items-center rounded-full border border-line bg-surface-2 shadow-lg">
          <span className="font-mono text-[10px] text-fg-dim">↔</span>
        </div>
      </div>

      {busy && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="animate-scan absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cyan/15 to-transparent" />
        </div>
      )}
    </div>
  );
}
