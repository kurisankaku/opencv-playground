import type { OpenCvJsSupportStatus, DemoDifficulty } from '../data/opencvDemos';
import type { DemoPriority } from '../data/opencvCategories';
import { supportMeta, difficultyMeta } from '../lib/labels';

export function SupportBadge({ status, full = false }: { status: OpenCvJsSupportStatus; full?: boolean }) {
  const m = supportMeta[status];
  return (
    <span className={`chip ${m.border} ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {full ? m.label : m.short}
    </span>
  );
}

export function DifficultyBadge({ level }: { level: DemoDifficulty }) {
  const m = difficultyMeta[level];
  return (
    <span className="chip" title={`難易度: ${m.label}`}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span
            key={b}
            className="w-[3px] rounded-sm"
            style={{
              height: `${4 + b * 2}px`,
              background: b <= m.bars ? 'var(--color-violet)' : 'var(--color-line)',
            }}
          />
        ))}
      </span>
      {m.label}
    </span>
  );
}

const priorityColor: Record<DemoPriority, string> = {
  S: 'text-[#ff4d6d]',
  A: 'text-[#f5a524]',
  B: 'text-[#22d3ee]',
  C: 'text-fg-faint',
};

export function PriorityBadge({ priority }: { priority: DemoPriority }) {
  return (
    <span className="chip" title={`優先度: ${priority}`}>
      <span className={`font-bold ${priorityColor[priority]}`}>{priority}</span>
    </span>
  );
}

export function MvpBadge() {
  return (
    <span className="chip border-[#7c5cff]/50 text-[#b6a6ff]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#7c5cff]" />
      MVP
    </span>
  );
}
