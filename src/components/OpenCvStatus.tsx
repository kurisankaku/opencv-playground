import { useOpenCv } from '../context/OpenCvContext';

/** Live "kernel status" indicator. When idle, doubles as a manual load trigger. */
export function OpenCvStatus() {
  const { status, ensureLoaded, retry } = useOpenCv();

  const map = {
    idle: { dot: 'bg-fg-faint', label: 'OpenCVを読み込む', pulse: false },
    loading: { dot: 'bg-[#f5a524]', label: 'OpenCV.js 読み込み中', pulse: true },
    ready: { dot: 'bg-[#34e0a1]', label: 'OpenCV.js 準備完了', pulse: false },
    error: { dot: 'bg-[#ff4d6d]', label: '読み込みエラー — 再試行', pulse: false },
  }[status];

  const clickable = status === 'idle' || status === 'error';
  const onClick = status === 'error' ? retry : status === 'idle' ? ensureLoaded : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`chip ${clickable ? 'cursor-pointer hover:border-fg-faint' : 'cursor-default'}`}
      title={`ランタイム: ${map.label}`}
    >
      <span className={`h-2 w-2 rounded-full ${map.dot} ${map.pulse ? 'animate-pulse-dot' : ''}`} />
      <span className="hidden sm:inline">{map.label}</span>
    </button>
  );
}
