import { useEffect, useRef, useState } from 'react';
import { useOpenCv } from '../context/OpenCvContext';
import { renderSample } from '../lib/sampleImages';
import { CompareView } from './CompareView';

/**
 * Home hero: a live Canny edge-detection transform — the single most
 * characteristic OpenCV operation, running in the worker as the page loads.
 */
export function LiveHero() {
  const { status, process } = useOpenCv();
  const [sensitivity, setSensitivity] = useState(55);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const token = useRef(0);
  const source = renderSample('scene');

  useEffect(() => {
    for (const ref of [beforeRef, afterRef]) {
      const c = ref.current;
      if (!c) continue;
      c.width = source.width;
      c.height = source.height;
      c.getContext('2d')?.drawImage(source, 0, 0);
    }
  }, [source]);

  useEffect(() => {
    const myToken = ++token.current;
    const t = setTimeout(() => {
      const sctx = source.getContext('2d');
      if (!sctx) return;
      const img = sctx.getImageData(0, 0, source.width, source.height);
      const t1 = (100 - sensitivity) * 1.4 + 8;
      process('canny-edge-detection', { data: img.data, width: img.width, height: img.height }, { t1, t2: t1 * 2.4 })
        .then((res) => {
          if (myToken !== token.current) return;
          const after = afterRef.current;
          if (!after) return;
          after.width = res.image.width;
          after.height = res.image.height;
          const actx = after.getContext('2d');
          if (actx) {
            const out = actx.createImageData(res.image.width, res.image.height);
            out.data.set(res.image.data);
            actx.putImageData(out, 0, 0);
          }
        })
        .catch(() => {
          /* hero is decorative; ignore failures */
        });
    }, 60);
    return () => clearTimeout(t);
  }, [sensitivity, source, process]);

  return (
    <div className="panel overflow-hidden p-3">
      <CompareView
        beforeRef={beforeRef}
        afterRef={afterRef}
        aspect={source.width / source.height}
        busy={status === 'loading'}
      />
      <div className="mt-3 px-1">
        <div className="mb-1.5 flex items-baseline justify-between">
          <label className="eyebrow">エッジ感度 · Canny</label>
          <span className="font-mono text-xs text-cyan">{sensitivity}</span>
        </div>
        <input type="range" min={5} max={95} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} />
        <p className="mt-2 font-mono text-[11px] text-fg-faint">
          cv.Canny() — ハンドルをドラッグして元画像と比較
        </p>
      </div>
    </div>
  );
}
