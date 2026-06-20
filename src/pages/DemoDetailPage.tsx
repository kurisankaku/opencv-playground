import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, ExternalLink, Wrench } from 'lucide-react';
import { openCvDemos, getDemosByCategory } from '../data/opencvDemos';
import { deferredNotes, deferReasonLabel } from '../data/deferredNotes';
import { getCategoryById } from '../data/opencvCategories';
import { getImpl } from '../lib/processors';
import { DemoRunner } from '../components/DemoRunner';
import { DemoCard } from '../components/DemoCard';
import { CodeBlock } from '../components/CodeBlock';
import { SupportBadge, DifficultyBadge, PriorityBadge, MvpBadge } from '../components/Badges';
import { categoryAccent } from '../lib/categoryColors';
import { phaseLabel, inputTypeLabel, outputTypeLabel } from '../lib/labels';
import { NotFoundPage } from './NotFoundPage';

export function DemoDetailPage() {
  const { slug } = useParams();
  const demo = openCvDemos.find((d) => d.slug === slug);
  if (!demo) return <NotFoundPage />;

  const category = getCategoryById(demo.categoryId);
  const accent = categoryAccent(demo.categoryId);
  const impl = getImpl(demo.id);
  const deferred = deferredNotes[demo.id];
  const related = getDemosByCategory(demo.categoryId)
    .filter((d) => d.id !== demo.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/demos" className="inline-flex items-center gap-1.5 text-sm text-fg-dim transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        デモ一覧
      </Link>

      {/* Header */}
      <div className="mt-5">
        <p className="eyebrow" style={{ color: accent }}>
          {category?.nameJa} · {category?.nameEn}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{demo.titleJa}</h1>
        <p className="mt-1 font-mono text-sm text-fg-faint">{demo.titleEn}</p>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-fg-dim">{demo.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SupportBadge status={demo.opencvJsSupport} full />
          <DifficultyBadge level={demo.difficulty} />
          <PriorityBadge priority={demo.priority} />
          {demo.isMvp && <MvpBadge />}
          <span className="chip">{phaseLabel[demo.phase]}</span>
        </div>
      </div>

      {/* Interactive area */}
      <div className="mt-8">
        {impl ? (
          <DemoRunner key={demo.id} demoId={demo.id} impl={impl} />
        ) : deferred ? (
          <div className="panel flex flex-col items-center gap-3 p-10 text-center">
            <Wrench className="h-7 w-7 text-[#f5a524]" />
            <p className="font-display text-lg font-semibold">このブラウザ環境では未対応</p>
            <span className="chip border-[#f5a524]/30 text-[#f8d58a]">
              理由: {deferReasonLabel[deferred.reason]}
            </span>
            <p className="max-w-xl text-sm leading-relaxed text-fg-dim">{deferred.detail}</p>
            <p className="max-w-xl text-xs text-fg-faint">
              ship する opencv.js (techstark 4.10) に対して実機検証した結果です。下記の仕様・コード例はネイティブ OpenCV を前提に参照できます。
            </p>
          </div>
        ) : (
          <div className="panel flex flex-col items-center gap-2 p-12 text-center">
            <Clock className="h-7 w-7 text-[#f5a524]" />
            <p className="font-display text-lg font-semibold">インタラクティブデモは近日実装</p>
            <p className="max-w-md text-sm text-fg-dim">
              この機能はカタログに仕様として定義済みです。下記の関数・パラメータ・コード例を参照してください。
              OpenCV.js 対応状況: <span className="font-mono">{demo.opencvJsSupport}</span>
            </p>
          </div>
        )}
      </div>

      {/* Detail grid */}
      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <Section title="この処理について">
            <p className="text-[15px] leading-relaxed text-fg-dim">{demo.longDescription ?? demo.description}</p>
          </Section>

          <Section title="ユースケース">
            <ul className="space-y-2">
              {demo.useCases.map((u) => (
                <li key={u} className="flex gap-2.5 text-[15px] text-fg-dim">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
                  {u}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="コード例">
            <CodeBlock code={demo.codeExample.code} language={demo.codeExample.language} />
          </Section>

          {demo.limitations && (
            <Section title="注意点・制約">
              <div className="rounded-xl border border-[#f5a524]/25 bg-[#f5a524]/5 p-4 text-[14px] leading-relaxed text-[#f8d58a]">
                {demo.limitations}
              </div>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          <SideCard title="OpenCV 関数 / クラス">
            <div className="space-y-2">
              {demo.opencvFunctions.map((f) => (
                <div key={f.name} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <p className="font-mono text-[13px] text-fg">{f.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-fg-faint">
                    {f.module}
                    {f.isContrib ? ' · contrib' : ''}
                  </p>
                </div>
              ))}
            </div>
          </SideCard>

          <SideCard title="入力 / 出力">
            <div className="flex flex-wrap gap-1.5">
              {demo.inputTypes.map((t) => (
                <span key={t} className="chip">
                  ▸ {inputTypeLabel[t] ?? t}
                </span>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {demo.outputTypes.map((t) => (
                <span key={t} className="chip border-cyan/30 text-cyan">
                  {outputTypeLabel[t] ?? t}
                </span>
              ))}
            </div>
          </SideCard>

          {!impl && demo.parameters.length > 0 && (
            <SideCard title="調整パラメータ (仕様)">
              <ul className="space-y-1.5 text-sm text-fg-dim">
                {demo.parameters.map((p) => (
                  <li key={p.id}>
                    <span className="text-fg">{p.nameJa}</span>
                    <span className="font-mono text-[11px] text-fg-faint"> · {p.opencvArg ?? p.id}</span>
                  </li>
                ))}
              </ul>
            </SideCard>
          )}

          <a
            href="https://docs.opencv.org/4.x/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-fg-dim transition-colors hover:text-fg"
          >
            OpenCV 4.x 公式ドキュメント
            <ExternalLink className="h-4 w-4" />
          </a>
        </aside>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 font-display text-xl font-bold">関連するデモ</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((d, i) => (
              <DemoCard key={d.id} demo={d} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <p className="eyebrow mb-3">{title}</p>
      {children}
    </div>
  );
}
