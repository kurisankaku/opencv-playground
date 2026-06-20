import type { RefObject } from 'react';
import { Video, VideoOff, AlertTriangle } from 'lucide-react';

/**
 * Live-camera preview for video demos. The webcam frames are grabbed and
 * streamed through the worker by DemoRunner; this just shows the processed
 * output canvas and the start/stop controls. The <video> element is hidden
 * (it's only the frame source).
 */
export function VideoView({
  videoRef,
  outRef,
  streaming,
  cameraError,
  onStart,
  onStop,
  aspect,
  busy = false,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  outRef: RefObject<HTMLCanvasElement>;
  streaming: boolean;
  cameraError: string | null;
  onStart: () => void;
  onStop: () => void;
  aspect: number;
  busy?: boolean;
}) {
  return (
    <div className="space-y-3" data-testid="video-preview">
      <div
        className="relative grid place-items-center overflow-hidden rounded-xl border border-line bg-[#06070b]"
        style={{ aspectRatio: String(aspect || 4 / 3) }}
      >
        {/* hidden frame source */}
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas
          ref={outRef}
          className={`absolute inset-0 h-full w-full object-contain ${streaming ? '' : 'hidden'}`}
        />
        {!streaming && (
          <div className="max-w-sm space-y-3 p-6 text-center">
            <Video className="mx-auto h-8 w-8 text-fg-faint" />
            <p className="text-sm text-fg-dim">
              カメラ映像をリアルタイムで処理します。ブラウザのカメラ許可が必要です（映像は端末内でのみ処理され送信されません）。
            </p>
            {cameraError && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-[#ff4d6d]">
                <AlertTriangle className="h-3.5 w-3.5" />
                {cameraError}
              </p>
            )}
            <button
              onClick={onStart}
              className="inline-flex items-center gap-2 rounded-lg border border-violet bg-violet/10 px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-violet/20"
            >
              <Video className="h-4 w-4" />
              カメラを開始
            </button>
          </div>
        )}
        {busy && streaming && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="animate-scan absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cyan/15 to-transparent" />
          </div>
        )}
      </div>
      {streaming && (
        <button
          onClick={onStop}
          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm text-fg-dim transition-colors hover:border-[#ff4d6d]/50 hover:text-fg"
        >
          <VideoOff className="h-4 w-4" />
          カメラを停止
        </button>
      )}
    </div>
  );
}
