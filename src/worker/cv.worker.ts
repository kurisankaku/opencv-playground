/**
 * OpenCV.js Web Worker.
 *
 * Loads + parses the ~10MB opencv.js and runs ALL cv processing on the worker
 * thread, so the main (UI) thread never blocks. The main thread only sends
 * ImageData in and receives ImageData out.
 *
 * Two non-obvious things this had to get right:
 *
 *  1. Loading: `fetch` + indirect `eval` (NOT importScripts). Vite's dev worker
 *     is a module worker where importScripts is absent, and faking it pushes
 *     Emscripten into pthread-worker mode (which deadlocks). Instead we stub a
 *     minimal window/document so OpenCV takes the plain WEB init path. We fetch
 *     from CORS-enabled CDNs (docs.opencv.org has no CORS).
 *
 *  2. The OpenCV namespace/Module is itself a *thenable*. It must never be
 *     passed to Promise.resolve() or returned from an async function, or the
 *     Promise machinery invokes OpenCV's own (broken) .then() and deadlocks the
 *     worker. We always carry it inside a plain wrapper object `{ cv }`.
 */
import { impls } from '../lib/processors';

const ctx = self as any;

// CORS-enabled mirrors of the official OpenCV.js build (so fetch() works).
const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js',
  'https://unpkg.com/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js',
];
const INIT_TIMEOUT_MS = 60000;
const FETCH_TIMEOUT_MS = 45000;

let loadPromise: Promise<{ cv: any }> | null = null;

// Persistent state for the active video demo (background model, previous frame,
// tracked points, …). Survives across streamed frames; freed on demo switch/reset.
let videoStore: { demoId: string; store: Record<string, any> } | null = null;
function disposeVideoStore() {
  if (!videoStore) return;
  for (const v of Object.values(videoStore.store)) {
    try {
      (v as any)?.delete?.();
    } catch {
      /* not a deletable cv object */
    }
  }
  videoStore = null;
}

function isCv(o: any): boolean {
  return !!o && typeof o.Mat === 'function';
}
function pickReady(): any {
  if (isCv(ctx.Module)) return ctx.Module;
  if (isCv(ctx.cv)) return ctx.cv;
  return null;
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { mode: 'cors', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function loadCv(): Promise<{ cv: any }> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // Make OpenCV detect a WEB environment (ENVIRONMENT_IS_WEB = typeof window).
    if (typeof ctx.window === 'undefined') ctx.window = ctx;
    if (typeof ctx.document === 'undefined') {
      ctx.document = {
        currentScript: { src: (ctx.location && ctx.location.href) || '' },
        createElement: () => ({ getContext: () => null, style: {} }),
        getElementById: () => null,
        addEventListener: () => {},
      };
    }
    ctx.Module = ctx.Module || {};

    let text: string | null = null;
    let lastErr = '';
    for (const url of CDN_URLS) {
      try {
        text = await fetchText(url);
        break;
      } catch (e: any) {
        lastErr = (e?.name === 'AbortError' ? 'timeout' : e?.message) ?? String(e);
      }
    }
    if (!text) {
      throw new Error('OpenCV.js のダウンロードに失敗しました（' + lastErr + '）。');
    }

    try {
      (0, eval)(text); // run the UMD in global scope → sets self.cv, uses self.Module
    } catch (e: any) {
      throw new Error('OpenCV.js の評価に失敗しました: ' + (e?.message ?? String(e)));
    }

    // Capture the (thenable) namespace into a plain wrapper — never let it flow
    // through resolve()/async-return (see file header, point 2).
    let captured: any = null;
    const start = Date.now();
    await new Promise<void>((resolve, reject) => {
      const poll = () => {
        const r = pickReady();
        if (r) {
          captured = r;
          resolve();
          return;
        }
        if (Date.now() - start > INIT_TIMEOUT_MS) {
          reject(new Error('OpenCV.js の初期化がタイムアウトしました。'));
          return;
        }
        setTimeout(poll, 50);
      };
      poll();
    });
    return { cv: captured };
  })().catch((e) => {
    loadPromise = null; // allow retry
    throw e;
  });
  return loadPromise;
}

interface CvImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Normalize any output Mat (1/3/4 channels) to an RGBA ImageData payload. */
function toRgbaImage(cv: any, mat: any): CvImage {
  const ch = mat.channels();
  let disp = mat;
  let temp: any = null;
  if (ch === 1) {
    temp = new cv.Mat();
    cv.cvtColor(mat, temp, cv.COLOR_GRAY2RGBA);
    disp = temp;
  } else if (ch === 3) {
    temp = new cv.Mat();
    cv.cvtColor(mat, temp, cv.COLOR_RGB2RGBA);
    disp = temp;
  }
  const data = new Uint8ClampedArray(disp.data); // copy out of the WASM heap
  const out: CvImage = { data, width: disp.cols, height: disp.rows };
  if (temp) temp.delete();
  return out;
}

ctx.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      await loadCv();
      ctx.postMessage({ type: 'ready' });
    } catch (err: any) {
      ctx.postMessage({ type: 'error', message: err?.message ?? String(err) });
    }
    return;
  }

  if (msg.type === 'process') {
    const { reqId, demoId, params, image, imageB, stream, reset } = msg as {
      reqId: number;
      demoId: string;
      params: Record<string, any>;
      image: CvImage;
      imageB?: CvImage;
      stream?: boolean;
      reset?: boolean;
    };
    let src: any;
    let srcB: any;
    let result: any;
    try {
      const { cv } = await loadCv();
      ctx.postMessage({ type: 'ready' }); // idempotent on the main side
      const impl = impls[demoId];
      if (!impl) throw new Error('このデモはまだ実装されていません: ' + demoId);

      src = new cv.Mat(image.height, image.width, cv.CV_8UC4);
      src.data.set(image.data);
      if (imageB) {
        srcB = new cv.Mat(imageB.height, imageB.width, cv.CV_8UC4);
        srcB.data.set(imageB.data);
      }

      // Stateful video streaming: keep a persistent per-demo store across frames.
      let extras: any = { srcB };
      if (stream) {
        const isNew = !videoStore || videoStore.demoId !== demoId || !!reset;
        if (isNew) {
          disposeVideoStore();
          videoStore = { demoId, store: {} };
        }
        extras = { srcB, state: videoStore!.store, firstFrame: isNew };
      }

      result = impl.run(cv, src, params, extras);
      const msg: any = { type: 'result', reqId, info: result.info ?? [] };
      const transfer: Transferable[] = [];
      if (result.output) {
        const out = toRgbaImage(cv, result.output);
        msg.image = out;
        transfer.push(out.data.buffer);
      }
      if (result.chart) msg.chart = result.chart;
      ctx.postMessage(msg, transfer);
    } catch (err: any) {
      ctx.postMessage({ type: 'result', reqId, error: err?.message ?? String(err) });
    } finally {
      result?.output?.delete?.();
      src?.delete?.();
      srcB?.delete?.();
    }
  }
};
