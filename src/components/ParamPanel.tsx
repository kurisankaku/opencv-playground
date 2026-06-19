import { RotateCcw } from 'lucide-react';
import type { RuntimeParam } from '../lib/processors';

export function ParamPanel({
  params,
  values,
  onChange,
  onReset,
}: {
  params: RuntimeParam[];
  values: Record<string, any>;
  onChange: (id: string, value: any) => void;
  onReset: () => void;
}) {
  if (params.length === 0) {
    return (
      <div className="panel p-4">
        <p className="eyebrow">パラメータ</p>
        <p className="mt-2 text-sm text-fg-dim">この処理に調整パラメータはありません。</p>
      </div>
    );
  }

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">パラメータ</p>
        <button onClick={onReset} className="flex items-center gap-1 text-xs text-fg-dim transition-colors hover:text-fg">
          <RotateCcw className="h-3 w-3" />
          リセット
        </button>
      </div>
      <div className="space-y-4">
        {params.map((p) => (
          <Control key={p.id} param={p} value={values[p.id]} onChange={(v) => onChange(p.id, v)} />
        ))}
      </div>
    </div>
  );
}

function Control({ param, value, onChange }: { param: RuntimeParam; value: any; onChange: (v: any) => void }) {
  if (param.type === 'slider') {
    return (
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label className="text-sm text-fg-dim">{param.label}</label>
          <span className="font-mono text-xs text-cyan">{value}</span>
        </div>
        <input
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    );
  }

  if (param.type === 'select') {
    return (
      <div>
        <label className="mb-1.5 block text-sm text-fg-dim">{param.label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none transition-colors focus:border-cyan"
        >
          {param.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // toggle
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm text-fg-dim">{param.label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? 'bg-violet' : 'bg-line'}`}
        role="switch"
        aria-checked={!!value}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}
