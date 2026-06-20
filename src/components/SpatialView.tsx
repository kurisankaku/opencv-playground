import type { RefObject } from 'react';
import type { RuntimeParam } from '../lib/processors';
import { SpatialEditor } from './SpatialEditor';

/**
 * Preview for spatial-input demos: the input image (with a draggable
 * point/rect overlay) on the left and the processed output on the right.
 * Used instead of the before/after CompareView when a demo has a 'points' or
 * 'rect' param.
 */
export function SpatialView({
  beforeRef,
  afterRef,
  aspect,
  imgW,
  imgH,
  param,
  value,
  onChange,
  busy = false,
}: {
  beforeRef: RefObject<HTMLCanvasElement>;
  afterRef: RefObject<HTMLCanvasElement>;
  aspect: number;
  imgW: number;
  imgH: number;
  param: RuntimeParam;
  value: any;
  onChange: (v: any) => void;
  busy?: boolean;
}) {
  const box = 'relative overflow-hidden rounded-xl border border-line bg-[#06070b]';
  const style = { aspectRatio: String(aspect || 4 / 3) };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="eyebrow flex items-center gap-1.5">
          入力
          <span className="font-mono text-[10px] normal-case text-cyan">ドラッグで指定</span>
        </p>
        <div className={box} style={style}>
          <canvas ref={beforeRef} className="absolute inset-0 h-full w-full object-contain" />
          <SpatialEditor imgW={imgW} imgH={imgH} param={param} value={value} onChange={onChange} />
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="eyebrow">出力</p>
        <div className={box} style={style}>
          <canvas ref={afterRef} className="absolute inset-0 h-full w-full object-contain" />
          {busy && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="animate-scan absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-cyan/15 to-transparent" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
