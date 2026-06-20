import CvWorker from '../worker/cv.worker?worker';
import type { ChartData } from './chartTypes';

/**
 * Main-thread client for the OpenCV.js worker. A single shared worker handles
 * loading and all processing; the UI thread only sends/receives ImageData.
 */

export type CvStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CvImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface ProcessResult {
  image?: CvImage; // absent for chart-only demos
  chart?: ChartData;
  info: { label: string; value: string }[];
}

type Listener = (status: CvStatus, error: string | null) => void;

let worker: Worker | null = null;
let status: CvStatus = 'idle';
let error: string | null = null;
let reqCounter = 0;

const listeners = new Set<Listener>();
const pending = new Map<number, { resolve: (r: ProcessResult) => void; reject: (e: Error) => void }>();

function emit() {
  for (const l of listeners) l(status, error);
}
function setStatus(next: CvStatus, err: string | null = null) {
  status = next;
  error = err;
  emit();
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new CvWorker();
  worker.addEventListener('message', (ev: MessageEvent) => {
    const m = ev.data;
    if (m.type === 'ready') {
      if (status !== 'ready') setStatus('ready');
    } else if (m.type === 'error') {
      setStatus('error', m.message ?? 'OpenCV.js の読み込みに失敗しました。');
    } else if (m.type === 'result') {
      const p = pending.get(m.reqId);
      if (!p) return;
      pending.delete(m.reqId);
      if (m.error) p.reject(new Error(m.error));
      else p.resolve({ image: m.image, chart: m.chart, info: m.info ?? [] });
    }
  });
  worker.addEventListener('error', (ev) =>
    setStatus('error', 'Worker エラー: ' + (ev.message || '不明なエラー')),
  );
  return worker;
}

export function getStatus(): { status: CvStatus; error: string | null } {
  return { status, error };
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function ensureLoaded() {
  const w = ensureWorker();
  if (status === 'ready' || status === 'loading') return;
  setStatus('loading');
  w.postMessage({ type: 'init' });
}

export function retry() {
  worker?.terminate();
  worker = null;
  pending.forEach((p) => p.reject(new Error('再読み込みのため中断しました。')));
  pending.clear();
  setStatus('idle');
  ensureLoaded();
}

export function processImage(
  demoId: string,
  image: CvImage,
  params: Record<string, any>,
  imageB?: CvImage,
): Promise<ProcessResult> {
  const w = ensureWorker();
  if (status === 'idle') ensureLoaded();
  const reqId = ++reqCounter;
  return new Promise((resolve, reject) => {
    pending.set(reqId, { resolve, reject });
    w.postMessage({ type: 'process', reqId, demoId, params, image, imageB });
  });
}
