import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Cpu, ShieldCheck, Sparkles } from 'lucide-react';
import { LiveHero } from '../components/LiveHero';
import { DemoCard } from '../components/DemoCard';
import { openCvCategories } from '../data/opencvCategories';
import { openCvDemos, getDemosByCategory } from '../data/opencvDemos';
import { implementedCount, isImplemented } from '../lib/processors';
import { categoryAccent } from '../lib/categoryColors';

export function HomePage() {
  const featured = openCvDemos.filter((d) => isImplemented(d.id)).slice(0, 8);

  const stats = [
    { value: '20', label: 'カテゴリ' },
    { value: String(openCvDemos.length), label: 'デモ' },
    { value: String(implementedCount), label: '体験できる' },
    { value: '100%', label: 'ブラウザ内処理' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="eyebrow">Computer Vision Playground</p>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="group inline-block">
              <span className="chromatic chromatic-hover">OpenCV</span>
            </span>
            <br />
            を、<span className="spectral-text">ブラウザで触って</span>学ぶ。
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-dim">
            関数一覧を読むより、動かす方が早い。画像を選んでパラメータを動かし、Before/After
            で結果を確かめる。{openCvDemos.length} のデモを、すべてブラウザ内 (OpenCV.js / WASM) で実行します。
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/demos" className="btn btn-primary">
              デモを試す
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/demo/canny-edge-detection" className="btn btn-ghost">
              Cannyエッジ検出を開く
            </Link>
          </div>

          <div className="mt-9 grid max-w-md grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-display text-2xl font-bold text-fg">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-fg-faint">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <LiveHero />
        </motion.div>
      </section>

      {/* Value props */}
      <section className="grid gap-3 py-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: '画像は送信されない', body: 'すべての処理はブラウザ内で完結。プライバシーを気にせず自分の写真で試せます。' },
          { icon: Cpu, title: 'WebAssembly で動く', body: 'OpenCV.js が C++ 由来の処理をブラウザでネイティブ級に実行します。' },
          { icon: Sparkles, title: '触って分かる', body: 'スライダを動かすと結果が即更新。パラメータの意味が体感で理解できます。' },
        ].map((v) => (
          <div key={v.title} className="panel p-5">
            <v.icon className="h-5 w-5 text-violet" />
            <p className="mt-3 font-display text-sm font-semibold">{v.title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-fg-dim">{v.body}</p>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section className="py-14">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="eyebrow">20 カテゴリ</p>
            <h2 className="mt-2 font-display text-2xl font-bold">機能をカテゴリから探す</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {openCvCategories.map((c, i) => {
            const accent = categoryAccent(c.id);
            const count = getDemosByCategory(c.id).length;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.2) }}
              >
                <Link to={`/demos?category=${c.id}`} className="panel panel-hover flex h-full flex-col p-4">
                  <span className="h-1 w-8 rounded-full" style={{ background: accent }} />
                  <p className="mt-3 font-display text-sm font-semibold leading-snug">{c.nameJa}</p>
                  <p className="font-mono text-[10px] text-fg-faint">{c.nameEn}</p>
                  <p className="mt-auto pt-3 font-mono text-[11px] text-fg-dim">{count} デモ</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Featured demos */}
      <section className="py-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="eyebrow">いますぐ体験できる</p>
            <h2 className="mt-2 font-display text-2xl font-bold">注目のデモ</h2>
          </div>
          <Link to="/demos" className="flex items-center gap-1 text-sm text-fg-dim transition-colors hover:text-fg">
            すべて見る <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((d, i) => (
            <DemoCard key={d.id} demo={d} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
