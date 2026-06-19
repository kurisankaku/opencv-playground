export function Footer() {
  return (
    <footer className="mt-24 border-t border-line/70">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row">
          <div className="max-w-md">
            <p className="font-display text-sm font-semibold">OpenCV Playground</p>
            <p className="mt-2 text-sm text-fg-dim">
              すべての画像処理はブラウザ内 (OpenCV.js / WebAssembly) で完結します。アップロードした画像が
              サーバーに送信されることはありません。
            </p>
          </div>
          <div className="text-sm text-fg-faint">
            <p className="eyebrow mb-2">技術スタック</p>
            <p className="font-mono text-xs leading-relaxed">
              React · TypeScript · Vite
              <br />
              Tailwind CSS · Framer Motion
              <br />
              OpenCV.js (WASM)
            </p>
          </div>
        </div>
        <p className="mt-8 text-xs text-fg-faint">
          OpenCV is licensed under Apache License 2.0. サンプル画像はすべてブラウザ内で生成された合成画像です。
        </p>
      </div>
    </footer>
  );
}
