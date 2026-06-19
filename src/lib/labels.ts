import type { OpenCvJsSupportStatus, DemoDifficulty } from '../data/opencvDemos';

export const supportMeta: Record<
  OpenCvJsSupportStatus,
  { label: string; short: string; dot: string; text: string; border: string }
> = {
  supported: {
    label: 'OpenCV.js 対応',
    short: '対応',
    dot: 'bg-[#34e0a1]',
    text: 'text-[#34e0a1]',
    border: 'border-[#34e0a1]/40',
  },
  'likely-supported': {
    label: '対応見込み',
    short: '見込み',
    dot: 'bg-[#22d3ee]',
    text: 'text-[#22d3ee]',
    border: 'border-[#22d3ee]/40',
  },
  'needs-investigation': {
    label: '要調査',
    short: '要調査',
    dot: 'bg-[#f5a524]',
    text: 'text-[#f5a524]',
    border: 'border-[#f5a524]/40',
  },
  'not-supported': {
    label: '未対応',
    short: '未対応',
    dot: 'bg-[#ff4d6d]',
    text: 'text-[#ff4d6d]',
    border: 'border-[#ff4d6d]/40',
  },
  'not-suitable-for-browser': {
    label: 'ブラウザ非推奨',
    short: '非推奨',
    dot: 'bg-fg-faint',
    text: 'text-fg-faint',
    border: 'border-line',
  },
};

export const difficultyMeta: Record<DemoDifficulty, { label: string; bars: number }> = {
  beginner: { label: '初級', bars: 1 },
  intermediate: { label: '中級', bars: 2 },
  advanced: { label: '上級', bars: 3 },
};

export const phaseLabel: Record<string, string> = {
  'phase-1': 'Phase 1 · 基本処理',
  'phase-2': 'Phase 2 · 輪郭・形状',
  'phase-3': 'Phase 3 · 解析・変換',
  'phase-4': 'Phase 4 · 動画・カメラ',
  'phase-5': 'Phase 5 · 物体検出',
  'phase-6': 'Phase 6 · 特徴点・合成',
  'phase-7': 'Phase 7 · DNN',
};

export const inputTypeLabel: Record<string, string> = {
  image: '画像',
  'multiple-images': '複数画像',
  video: '動画',
  camera: 'カメラ',
  drawing: '描画',
  'sample-only': 'サンプル限定',
};

export const outputTypeLabel: Record<string, string> = {
  image: '画像',
  mask: 'マスク',
  overlay: '重畳',
  chart: 'グラフ',
  numeric: '数値',
  text: 'テキスト',
  geometry: '幾何',
  video: '動画',
};
