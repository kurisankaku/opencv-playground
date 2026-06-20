import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useOpenCv } from '../context/OpenCvContext';
import type { DemoImpl, InfoItem } from '../lib/processors';
import type { ChartData } from '../lib/chartTypes';
import { renderSample } from '../lib/sampleImages';
import { CompareView } from './CompareView';
import { HistogramChart } from './HistogramChart';
import { SpatialView } from './SpatialView';
import { TwoImageView } from './TwoImageView';
import { VideoView } from './VideoView';
import { ImageSource } from './ImageSource';
import { ParamPanel } from './ParamPanel';
import { InfoTable } from './InfoTable';
import type { RuntimeParam } from '../lib/processors';

/** Convert a spatial param's fractional default into pixel coordinates. */
function spatialToPixels(p: RuntimeParam, w: number, h: number) {
  if (p.type === 'rect') {
    const [fx, fy, fw, fh] = p.default as number[];
    return [Math.round(fx * w), Math.round(fy * h), Math.round(fw * w), Math.round(fh * h)];
  }
  return (p.default as number[][]).map(([fx, fy]) => [Math.round(fx * w), Math.round(fy * h)]);
}

/** Initial param values; spatial params are converted to pixel coordinates. */
function initParams(impl: DemoImpl, w: number, h: number): Record<string, any> {
  const o: Record<string, any> = {};
  for (const p of impl.params) {
    o[p.id] = p.type === 'points' || p.type === 'rect' ? spatialToPixels(p, w, h) : p.default;
  }
  return o;
}

export function DemoRunner({ demoId, impl }: { demoId: string; impl: DemoImpl }) {
  const { status, error: cvError, retry, process } = useOpenCv();

  const [sampleId, setSampleId] = useState(impl.defaultSample);
  const [uploaded, setUploaded] = useState(false);
  const [source, setSource] = useState<HTMLCanvasElement>(() => renderSample(impl.defaultSample));
  const [params, setParams] = useState<Record<string, any>>(() => initParams(impl, source.width, source.height));
  const [info, setInfo] = useState<InfoItem[]>([]);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const isChart = impl.output === 'chart';
  const spatialParam = impl.params.find((p) => p.type === 'points' || p.type === 'rect');
  const isTwo = !!impl.secondSample;
  const isVideo = impl.input === 'video';

  const [streaming, setStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Second input image (B) for two-image demos.
  const [sampleIdB, setSampleIdB] = useState(impl.secondSample ?? 'shapes');
  const [uploadedB, setUploadedB] = useState(false);
  const [sourceB, setSourceB] = useState<HTMLCanvasElement | null>(() =>
    impl.secondSample ? renderSample(impl.secondSample) : null,
  );

  const beforeRef = useRef<HTMLCanvasElement>(null);
  const afterRef = useRef<HTMLCanvasElement>(null);
  const bRef = useRef<HTMLCanvasElement>(null);
  const token = useRef(0);
  const dims = useRef({ w: source.width, h: source.height });

  // --- video (webcam) streaming ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const inFlight = useRef(false);
  const resetNext = useRef(true);
  const grabRef = useRef<HTMLCanvasElement | null>(null);
  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; }, [params]);

  const stopCamera = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  };

  const frameLoop = () => {
    rafRef.current = requestAnimationFrame(frameLoop);
    const v = videoRef.current;
    if (!v || v.readyState < 2 || inFlight.current) return;
    if (!grabRef.current) grabRef.current = document.createElement('canvas');
    const gc = grabRef.current;
    const w = 480;
    const h = Math.max(1, Math.round((v.videoHeight / v.videoWidth) * w)) || 360;
    gc.width = w;
    gc.height = h;
    const gctx = gc.getContext('2d');
    if (!gctx) return;
    gctx.drawImage(v, 0, 0, w, h);
    const img = gctx.getImageData(0, 0, w, h);
    inFlight.current = true;
    const reset = resetNext.current;
    resetNext.current = false;
    setBusy(true);
    process(demoId, { data: img.data, width: w, height: h }, paramsRef.current, undefined, { stream: true, reset })
      .then((res) => {
        const out = afterRef.current;
        if (res.image && out) {
          out.width = res.image.width;
          out.height = res.image.height;
          const octx = out.getContext('2d');
          if (octx) {
            const id = octx.createImageData(res.image.width, res.image.height);
            id.data.set(res.image.data);
            octx.putImageData(id, 0, 0);
          }
        }
        setInfo(res.info);
        setRunError(null);
      })
      .catch((e: Error) => setRunError(e.message))
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      resetNext.current = true;
      setStreaming(true);
      rafRef.current = requestAnimationFrame(frameLoop);
    } catch (e: any) {
      setCameraError('カメラにアクセスできませんでした（' + (e?.message ?? e) + '）。');
    }
  };

  // Stop the camera when leaving the demo / unmounting.
  useEffect(() => () => stopCamera(), [demoId]);

  // Draw image B into its thumbnail canvas.
  useEffect(() => {
    if (!sourceB) return;
    const c = bRef.current;
    if (!c) return;
    c.width = sourceB.width;
    c.height = sourceB.height;
    c.getContext('2d')?.drawImage(sourceB, 0, 0);
  }, [sourceB]);

  // Draw the source into both canvases (after = baseline until processed).
  // When the image *dimensions* change, re-seed spatial params to fit the new size.
  useEffect(() => {
    for (const ref of [beforeRef, afterRef]) {
      const c = ref.current;
      if (!c) continue;
      c.width = source.width;
      c.height = source.height;
      c.getContext('2d')?.drawImage(source, 0, 0);
    }
    if (dims.current.w !== source.width || dims.current.h !== source.height) {
      dims.current = { w: source.width, h: source.height };
      setParams((prev) => {
        const next = { ...prev };
        for (const p of impl.params) {
          if (p.type === 'points' || p.type === 'rect') next[p.id] = spatialToPixels(p, source.width, source.height);
        }
        return next;
      });
    }
  }, [source, impl]);

  // Send the image to the worker (debounced) whenever source or params change.
  // Video demos are driven by the frame loop instead, so skip this path.
  useEffect(() => {
    if (isVideo) return;
    const myToken = ++token.current;
    setBusy(true);
    const handle = setTimeout(() => {
      const sctx = source.getContext('2d');
      if (!sctx) return;
      const img = sctx.getImageData(0, 0, source.width, source.height);
      let imageB;
      if (isTwo && sourceB) {
        const bctx = sourceB.getContext('2d');
        if (bctx) {
          const ib = bctx.getImageData(0, 0, sourceB.width, sourceB.height);
          imageB = { data: ib.data, width: ib.width, height: ib.height };
        }
      }
      process(demoId, { data: img.data, width: img.width, height: img.height }, params, imageB)
        .then((res) => {
          if (myToken !== token.current) return; // a newer request superseded this one
          setChart(res.chart ?? null);
          const after = afterRef.current;
          if (res.image && after) {
            after.width = res.image.width;
            after.height = res.image.height;
            const actx = after.getContext('2d');
            if (actx) {
              const out = actx.createImageData(res.image.width, res.image.height);
              out.data.set(res.image.data);
              actx.putImageData(out, 0, 0);
            }
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
  }, [source, sourceB, params, demoId, process, isTwo, isVideo]);

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

        {isVideo ? (
          <VideoView
            videoRef={videoRef}
            outRef={afterRef}
            streaming={streaming}
            cameraError={cameraError}
            onStart={startCamera}
            onStop={stopCamera}
            aspect={4 / 3}
            busy={busy}
          />
        ) : isTwo ? (
          <TwoImageView
            aRef={beforeRef}
            bRef={bRef}
            outRef={afterRef}
            aspectA={aspect}
            aspectB={sourceB ? sourceB.width / sourceB.height : aspect}
            isChart={isChart}
            chart={chart}
            busy={busy}
          />
        ) : isChart ? (
          <div className="space-y-3" data-testid="chart-preview">
            <div className="overflow-hidden rounded-xl border border-line bg-[#06070b]">
              <canvas
                ref={beforeRef}
                className="mx-auto block max-h-[26vh] w-auto max-w-full object-contain lg:max-h-[34vh]"
                style={{ aspectRatio: String(aspect || 4 / 3) }}
              />
            </div>
            <HistogramChart data={chart} busy={busy} />
          </div>
        ) : spatialParam ? (
          <div data-testid="spatial-preview">
            <SpatialView
              beforeRef={beforeRef}
              afterRef={afterRef}
              aspect={aspect}
              imgW={source.width}
              imgH={source.height}
              param={spatialParam}
              value={params[spatialParam.id]}
              onChange={(v) => setParams((prev) => ({ ...prev, [spatialParam.id]: v }))}
              busy={busy}
            />
          </div>
        ) : (
          <CompareView
            beforeRef={beforeRef}
            afterRef={afterRef}
            aspect={aspect}
            busy={busy}
            className="max-h-[44vh] lg:max-h-none"
          />
        )}
      </div>

      <div className="space-y-4">
        <ParamPanel
          params={impl.params}
          values={params}
          onChange={(id, value) => setParams((prev) => ({ ...prev, [id]: value }))}
          onReset={() => setParams(initParams(impl, source.width, source.height))}
        />
        <InfoTable items={info} />
        {!isVideo && (
          <ImageSource
            title={isTwo ? '入力画像 A' : '入力画像'}
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
        )}
        {isTwo && (
          <ImageSource
            title="入力画像 B"
            activeSampleId={sampleIdB}
            uploaded={uploadedB}
            onPickSample={(id) => {
              setUploadedB(false);
              setSampleIdB(id);
              setSourceB(renderSample(id));
            }}
            onUpload={(canvas) => {
              setUploadedB(true);
              setSourceB(canvas);
            }}
          />
        )}
      </div>
    </div>
  );
}
