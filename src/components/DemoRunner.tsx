import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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

export function DemoRunner({ impl }: { impl: DemoImpl }) {
  const { cv, status, error: cvError } = useOpenCv();

  const [sampleId, setSampleId] = useState(impl.defaultSample);
  const [uploaded, setUploaded] = useState(false);
  const [source, setSource] = useState<HTMLCanvasElement>(() => renderSample(impl.defaultSample));
  const [params, setParams] = useState<Record<string, any>>(() => defaults(impl));
  const [info, setInfo] = useState<InfoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);

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

  // Run the processor (debounced) whenever cv, source, or params change.
  useEffect(() => {
    if (!cv) return;
    setBusy(true);
    const handle = setTimeout(() => {
      let src: any;
      let result: any;
      try {
        src = cv.imread(source);
        result = impl.run(cv, src, params);
        if (afterRef.current) cv.imshow(afterRef.current, result.output);
        setInfo(result.info ?? []);
        setRunError(null);
      } catch (e: any) {
        setRunError(e?.message ? String(e.message) : '処理中にエラーが発生しました。');
      } finally {
        result?.output?.delete?.();
        src?.delete?.();
        setBusy(false);
      }
    }, 60);
    return () => clearTimeout(handle);
  }, [cv, source, params, impl]);

  const aspect = source.width / source.height;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {status === 'loading' && (
          <div className="flex items-center gap-2 rounded-lg border border-[#f5a524]/30 bg-[#f5a524]/5 px-4 py-2.5 text-sm text-[#f5a524]">
            <Loader2 className="h-4 w-4 animate-spin" />
            OpenCV.js (WebAssembly) を読み込んでいます… 初回は数秒かかります。
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 rounded-lg border border-[#ff4d6d]/30 bg-[#ff4d6d]/5 px-4 py-2.5 text-sm text-[#ff4d6d]">
            <AlertTriangle className="h-4 w-4" />
            {cvError ?? 'OpenCV.js の読み込みに失敗しました。'}
          </div>
        )}
        {runError && (
          <div className="flex items-center gap-2 rounded-lg border border-[#ff4d6d]/30 bg-[#ff4d6d]/5 px-4 py-2.5 text-sm text-[#ff4d6d]">
            <AlertTriangle className="h-4 w-4" />
            {runError}
          </div>
        )}

        <CompareView beforeRef={beforeRef} afterRef={afterRef} aspect={aspect} busy={busy} />
        <InfoTable items={info} />
      </div>

      <div className="space-y-4">
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
        <ParamPanel
          params={impl.params}
          values={params}
          onChange={(id, value) => setParams((prev) => ({ ...prev, [id]: value }))}
          onReset={() => setParams(defaults(impl))}
        />
      </div>
    </div>
  );
}
