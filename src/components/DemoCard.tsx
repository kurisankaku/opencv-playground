import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { OpenCvDemo } from '../data/opencvDemos';
import { getCategoryById } from '../data/opencvCategories';
import { SupportBadge, DifficultyBadge } from './Badges';
import { categoryAccent } from '../lib/categoryColors';
import { isImplemented } from '../lib/processors';

export function DemoCard({ demo, index = 0 }: { demo: OpenCvDemo; index?: number }) {
  const category = getCategoryById(demo.categoryId);
  const accent = categoryAccent(demo.categoryId);
  const live = isImplemented(demo.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link
        to={`/demo/${demo.slug}`}
        className="group panel panel-hover relative flex h-full flex-col gap-3 p-4"
      >
        <span className="absolute left-0 top-4 h-7 w-1 rounded-r-full" style={{ background: accent }} />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="eyebrow truncate" style={{ color: accent }}>
              {category?.nameJa}
            </p>
            <h3 className="mt-1 font-display text-[15px] font-semibold leading-snug">{demo.titleJa}</h3>
            <p className="font-mono text-[11px] text-fg-faint">{demo.titleEn}</p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-fg-faint transition-colors group-hover:text-fg" />
        </div>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-fg-dim">{demo.description}</p>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {live && (
            <span className="chip border-[#34e0a1]/40 text-[#34e0a1]">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[#34e0a1]" />
              体験できる
            </span>
          )}
          <SupportBadge status={demo.opencvJsSupport} />
          <DifficultyBadge level={demo.difficulty} />
        </div>
      </Link>
    </motion.div>
  );
}
