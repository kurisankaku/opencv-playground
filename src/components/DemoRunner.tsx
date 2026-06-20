import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useOpenCv } from '../context/OpenCvContext';
import type { DemoImpl, InfoItem } from '../lib/processors';
import { renderSample } from '../lib/sampleImages';
import { CompareView } from './CompareView';
import { ImageSource } from './ImageSource';
import { ParamPanel } from './ParamPanel';
import { InfoTable } from './InfoTable';

function defaults(impl: DemoImpl): Record<string, any> {
  const o: Record<string, any> = {};
  for (const p of impl.params) o[p.id] = p.default;
  return o;
}

export function DemoRunner({ demoId, impl }: { demoId: string; impl: DemoImpl }) {
  const { status, error: cvError, retry, process } = useOpenCv();

  const [sampleId, setSampleId] = useState(impl.defaultSample);
  const [uploaded, setUploaded] = useState(false);
  const [source, setSource] = useState<HTMLCanvasElement>(() => renderSample(impl.defaultSample));
  const [params, setParams] = useState<Record<string, any>>(() => defaults(impl));
  const [info, setInfo] = useState<InfoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const token = useRef(0);

  // Draw the source into both canvases (after = baseline until processed).
  useEffect(() => {
    for (const ref of [beforeRef, afterRef]) {
      const c = ref.current;
      if (!c) continue;
      c.width = source.width;
      c.height = source.height;
      c.getContext('2d')?.drawImage(source, 0, 0);
    }
  }, [source]);

  // Send the image to the worker (debounced) whenever source or params change.
  useEffect(() => {
    const myToken = ++token.current;
    setBusy(true);
    const handle = setTimeout(() => {
      const sctx = source.getContext('2d');
      if (!sctx) return;
      const img = sctx.getImageData(0, 0, source.width, source.height);
      process(demoId, { data: img.data, width: img.width, height: img.height }, params)
        .then((res) => {
          if (myToken !== token.current) return; // a newer request superseded this one
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
          setInfo(res.info);
          setRunError(null);
        })
        .catch((e: Error) => {
          if (myToken === token.current) setRunError(e.message);
        })
        .finally(() => {
          if (myToken === token.current) setBusy(false);
        });
    }, 80);
    return () => clearTimeout(handle);
  }, [source, params, demoId, process]);

  const aspect = source.width / source.height;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px]">
      {/* Preview — pinned to the top so it stays visible while adjusting params
          (height-capped on mobile/tablet; normal sticky column on desktop). */}
      <div className="sticky top-14 z-20 self-start space-y-3 border-b border-line/60 bg-ink pb-3 lg:top-[4.75rem] lg:border-0 lg:bg-transparent lg:pb-0">
        {status === 'loading' && (
          <div className="flex items-center gap-2 rounded-lg border border-[#f5a524]/30 bg-[#f5a524]/5 px-4 py-2.5 text-sm text-[#f5a524]">
            <Loader2 className="h-4 w-4 animate-spin" />
            OpenCV.js (WebAssembly · 約10MB) をバックグラウンドで読み込み中… 画面は操作できます。初回は十数秒かかることがあります。
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#ff4d6d]/30 bg-[#ff4d6d]/5 px-4 py-2.5 text-sm text-[#ff4d6d]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{cvError ?? 'OpenCV.js の読み込みに失敗しました。'}</span>
            <button
              onClick={retry}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#ff4d6d]/40 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[#ff4d6d]/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              再読み込み
            </button>
          </div>
        )}
        {runError && status !== 'error' && (
          <div className="flex items-center gap-2 rounded-lg border border-[#ff4d6d]/30 bg-[#ff4d6d]/5 px-4 py-2.5 text-sm text-[#ff4d6d]">
            <AlertTriangle className="h-4 w-4" />
            {runError}
          </div>
        )}

        <CompareView
          beforeRef={beforeRef}
          afterRef={afterRef}
          aspect={aspect}
          busy={busy}
          className="max-h-[44vh] lg:max-h-none"
        />
      </div>

      <div className="space-y-4">
        <ParamPanel
          params={impl.params}
          values={params}
          onChange={(id, value) => setParams((prev) => ({ ...prev, [id]: value }))}
          onReset={() => setParams(defaults(impl))}
        />
        <InfoTable items={info} />
        <ImageSource
          activeSampleId={sampleId}
          uploaded={uploaded}
          onPickSample={(id) => {
            setUploaded(false);
            setSampleId(id);
            setSource(renderSample(id));
          }}
          onUpload={(canvas) => {
            setUploaded(true);
            setSource(canvas);
          }}
        />
      </div>
    </div>
  );
}
