import type { InfoItem } from '../lib/processors';

export function InfoTable({ items }: { items: InfoItem[] }) {
  if (!items.length) return null;
  return (
    <div className="panel p-4">
      <p className="eyebrow mb-3">処理結果</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.label} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
            <p className="text-[11px] text-fg-faint">{it.label}</p>
            <p className="mt-0.5 font-mono text-sm text-fg">{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
