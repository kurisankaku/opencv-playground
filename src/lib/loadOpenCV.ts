import type { Cv } from '../types/opencv';

/**
 * OpenCV.js loader.
 *
 * The WASM runtime is large (~8–10MB) and initializes asynchronously, so we
 * inject the script lazily and resolve only once `cv.Mat` is actually callable.
 * Different opencv.js builds expose readiness differently (a Promise, an
 * `onRuntimeInitialized` hook, or an already-ready object) — we handle all three.
 */

const OPENCV_URL = 'https://docs.opencv.org/4.x/opencv.js';

let loaderPromise: Promise<Cv> | null = null;

function ready(candidate: any): boolean {
  return candidate && typeof candidate.Mat === 'function';
}

function pollUntilReady(resolve: (cv: Cv) => void, reject: (e: Error) => void) {
  const started = Date.now();
  const timer = setInterval(() => {
    if (ready((window as any).cv)) {
      clearInterval(timer);
      resolve((window as any).cv);
    } else if (Date.now() - started > 40000) {
      clearInterval(timer);
      reject(new Error('OpenCV.js の初期化がタイムアウトしました。'));
    }
  }, 40);
}

export function loadOpenCV(): Promise<Cv> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<Cv>((resolve, reject) => {
    if (ready((window as any).cv)) {
      resolve((window as any).cv);
      return;
    }

    const existing = document.getElementById('opencv-js-script') as HTMLScriptElement | null;

    const onScriptReady = () => {
      const cv: any = (window as any).cv;
      // Newer builds expose `cv` as a Promise resolving to the namespace.
      if (cv && typeof cv.then === 'function') {
        cv.then((resolved: Cv) => {
          (window as any).cv = resolved;
          resolved.Mat ? resolve(resolved) : pollUntilReady(resolve, reject);
        }).catch(reject);
        return;
      }
      if (ready(cv)) {
        resolve(cv);
        return;
      }
      // Classic builds: wait for the runtime hook, then double-check by polling.
      if (cv) cv.onRuntimeInitialized = () => resolve(cv);
      pollUntilReady(resolve, reject);
    };

    if (existing) {
      onScriptReady();
      return;
    }

    const script = document.createElement('script');
    script.id = 'opencv-js-script';
    script.src = OPENCV_URL;
    script.async = true;
    script.onload = onScriptReady;
    script.onerror = () =>
      reject(new Error('OpenCV.js の読み込みに失敗しました。ネットワーク接続を確認してください。'));
    document.body.appendChild(script);
  });

  return loaderPromise;
}
