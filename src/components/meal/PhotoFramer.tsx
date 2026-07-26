'use client';

/**
 * 写真の「画角」（カードに表示するときどこを中心に見せるか）を決めるエディタ。
 *
 * カード類は写真を 4:3 に切り抜いて表示するため、縦長写真などは上下が切れる。
 * ここでドラッグして見せたい位置に寄せられる。値は object-position 相当の 0-100%。
 * 既定は中央(50,50) ＝ 従来と同じ見え方なので、触らなければ何も変わらない。
 *
 * 写真そのものは切り抜かない（原本を保存し、全画面表示では全体を見られる）。
 */

import { useRef, useState, useCallback } from 'react';

export const FOCUS_CENTER = 50;

type Props = {
  src: string;
  focusX: number;
  focusY: number;
  onChange: (focus: { x: number; y: number }) => void;
};

/** はみ出し量（px）。0 ならその軸は動かせない（＝切れていない）。 */
type Overflow = { x: number; y: number };

export default function PhotoFramer({ src, focusX, focusY, onChange }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<Overflow>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  // ドラッグ開始時のポインタ位置と、その時点の focus 値
  const startRef = useRef<{ px: number; py: number; fx: number; fy: number } | null>(null);

  /**
   * object-cover で描画したときのはみ出し量を実測する。
   * 表示サイズ = 自然サイズ × max(枠幅/自然幅, 枠高/自然高)。
   */
  const measure = useCallback((img: HTMLImageElement) => {
    const box = boxRef.current;
    if (!box || !img.naturalWidth || !img.naturalHeight) return;
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    const scale = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
    setOverflow({
      x: Math.max(0, img.naturalWidth * scale - bw),
      y: Math.max(0, img.naturalHeight * scale - bh),
    });
  }, []);

  const movableX = overflow.x > 1;
  const movableY = overflow.y > 1;
  const movable = movableX || movableY;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!movable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { px: e.clientX, py: e.clientY, fx: focusX, fy: focusY };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (!start) return;
    // 指を動かした向きに写真が動く = focus は逆向きに動かす。
    // はみ出し量ぶんの移動で 0→100% になるよう px を % に換算する。
    const nextX = movableX
      ? clamp(start.fx - ((e.clientX - start.px) / overflow.x) * 100)
      : focusX;
    const nextY = movableY
      ? clamp(start.fy - ((e.clientY - start.py) / overflow.y) * 100)
      : focusY;
    onChange({ x: Math.round(nextX), y: Math.round(nextY) });
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    startRef.current = null;
    setDragging(false);
  }

  const isCenter = focusX === FOCUS_CENTER && focusY === FOCUS_CENTER;

  return (
    <div>
      <div
        ref={boxRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative w-full aspect-[4/3] overflow-hidden rounded-xl bg-gray-100 select-none ${
          movable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        style={{ touchAction: 'none' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="画角を調整"
          onLoad={(e) => measure(e.currentTarget)}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `${focusX}% ${focusY}%` }}
        />

        {/* 三分割ガイド（ドラッグ中のみ） */}
        {dragging && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
          </div>
        )}

        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/55 text-white text-[11px] font-bold whitespace-nowrap pointer-events-none">
          {movable ? 'ドラッグして位置を調整' : 'この写真は切れていません'}
        </span>
      </div>

      {movable && (
        <button
          type="button"
          onClick={() => onChange({ x: FOCUS_CENTER, y: FOCUS_CENTER })}
          disabled={isCenter}
          className="mt-2 w-full py-2 text-xs font-bold text-gray-500 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
        >
          中央に戻す
        </button>
      )}
    </div>
  );
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v));
}
