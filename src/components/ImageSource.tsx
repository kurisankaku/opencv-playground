import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { sampleImages, sampleDataUrl } from '../lib/sampleImages';
import { loadImageFromFile, sourceToCanvas } from '../lib/cvUtils';

export function ImageSource({
  activeSampleId,
  uploaded,
  onPickSample,
  onUpload,
}: {
  activeSampleId: string | null;
  uploaded: boolean;
  onPickSample: (id: string) => void;
  onUpload: (canvas: HTMLCanvasElement) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    try {
      const img = await loadImageFromFile(file);
      onUpload(sourceToCanvas(img));
    } catch {
      /* ignore decode errors */
    }
  };

  return (
    <div className="panel p-4">
      <p className="eyebrow mb-3">入力画像</p>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {sampleImages.map((s) => {
          const active = !uploaded && activeSampleId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onPickSample(s.id)}
              title={s.hint}
              className={`group relative overflow-hidden rounded-lg border transition-all ${
                active ? 'border-violet ring-1 ring-violet' : 'border-line hover:border-fg-faint'
              }`}
            >
              <img src={sampleDataUrl(s.id)} alt={s.label} className="aspect-[4/3] w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-1.5 py-1 text-left font-mono text-[10px] text-fg">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm transition-colors ${
          dragOver
            ? 'border-cyan bg-cyan/5 text-fg'
            : uploaded
              ? 'border-violet text-fg'
              : 'border-line text-fg-dim hover:border-fg-faint hover:text-fg'
        }`}
      >
        <Upload className="h-4 w-4" />
        {uploaded ? 'アップロード画像を使用中 — 変更する' : '画像をドロップ / クリックして選択'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>
      <p className="mt-2 text-[11px] text-fg-faint">
        画像はブラウザ内でのみ処理され、送信されません。長辺は自動的に縮小されます。
      </p>
    </div>
  );
}
