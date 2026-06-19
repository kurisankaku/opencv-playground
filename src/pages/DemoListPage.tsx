import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { openCvDemos } from '../data/opencvDemos';
import { openCvCategories } from '../data/opencvCategories';
import { DemoCard } from '../components/DemoCard';
import { isImplemented } from '../lib/processors';

export function DemoListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get('category') ?? 'all';
  const [query, setQuery] = useState('');
  const [liveOnly, setLiveOnly] = useState(false);

  const setCategory = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('category');
    else next.set('category', id);
    setSearchParams(next);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return openCvDemos
      .filter((d) => (category === 'all' ? true : d.categoryId === category))
      .filter((d) => (liveOnly ? isImplemented(d.id) : true))
      .filter((d) =>
        q
          ? d.titleJa.toLowerCase().includes(q) ||
            d.titleEn.toLowerCase().includes(q) ||
            d.description.toLowerCase().includes(q) ||
            d.opencvFunctions.some((f) => f.name.toLowerCase().includes(q))
          : true,
      )
      .sort((a, b) => Number(isImplemented(b.id)) - Number(isImplemented(a.id)));
  }, [category, query, liveOnly]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Catalog</p>
      <h1 className="mt-2 font-display text-3xl font-bold">デモ一覧</h1>
      <p className="mt-2 text-fg-dim">
        全 {openCvDemos.length} デモ。<span className="text-[#34e0a1]">緑のラベル</span>が付いたものは、いますぐブラウザで実行できます。
      </p>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="機能名・関数名で検索 (例: Canny, 輪郭, threshold)"
            className="w-full rounded-lg border border-line bg-surface-2 py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-cyan"
          />
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-fg-dim">
          <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} className="accent-[#7c5cff]" />
          体験できるもののみ
        </label>
      </div>

      {/* Category chips */}
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={category === 'all'} onClick={() => setCategory('all')}>
          すべて
        </Chip>
        {openCvCategories.map((c) => (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
            {c.nameJa}
          </Chip>
        ))}
      </div>

      <p className="mt-5 font-mono text-xs text-fg-faint">{filtered.length} 件</p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((d, i) => (
          <DemoCard key={d.id} demo={d} index={i} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="panel mt-6 p-10 text-center text-fg-dim">
          条件に合うデモが見つかりませんでした。検索語やフィルタを変えてみてください。
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active ? 'border-violet bg-violet/10 text-fg' : 'border-line text-fg-dim hover:border-fg-faint hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}
