import { useEffect, useRef, useState } from 'react';
import { useOpenCv } from '../context/OpenCvContext';
import { renderSample } from '../lib/sampleImages';
import { CompareView } from './CompareView';

/**
 * Home hero: a live Canny edge-detection transform — the single most
 * characteristic OpenCV operation, running in real time as the page loads.
 */
export function LiveHero() {
  const { cv } = useOpenCv();
  const [sensitivity, setSensitivity] = useState(55);
  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
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
    if (!cv) return;
    const t = setTimeout(() => {
      let src, gray, edges;
      try {
        src = cv.imread(source);
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0);
        edges = new cv.Mat();
        const t1 = (100 - sensitivity) * 1.4 + 8;
        cv.Canny(gray, edges, t1, t1 * 2.4, 3, false);
        if (afterRef.current) cv.imshow(afterRef.current, edges);
      } catch {
        /* ignore */
      } finally {
        edges?.delete();
        gray?.delete();
        src?.delete();
      }
    }, 40);
    return () => clearTimeout(t);
  }, [cv, sensitivity, source]);

  return (
    <div className="panel overflow-hidden p-3">
      <CompareView beforeRef={beforeRef} afterRef={afterRef} aspect={source.width / source.height} />
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
