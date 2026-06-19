import { useOpenCv } from '../context/OpenCvContext';

/** Live "kernel status" indicator — reads like a REPL/notebook runtime light. */
export function OpenCvStatus() {
  const { status } = useOpenCv();

  const map = {
    idle: { dot: 'bg-fg-faint', label: '待機中', pulse: false },
    loading: { dot: 'bg-[#f5a524]', label: 'OpenCV.js 読み込み中', pulse: true },
    ready: { dot: 'bg-[#34e0a1]', label: 'OpenCV.js 準備完了', pulse: false },
    error: { dot: 'bg-[#ff4d6d]', label: '読み込みエラー', pulse: false },
  }[status];

  return (
    <span className="chip" title={`ランタイム: ${map.label}`}>
      <span className={`h-2 w-2 rounded-full ${map.dot} ${map.pulse ? 'animate-pulse-dot' : ''}`} />
      <span className="hidden sm:inline">{map.label}</span>
    </span>
  );
}
