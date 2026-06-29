'use client';

import { useState, useRef, useEffect, useCallback, type CSSProperties, type PointerEvent } from 'react';
import { RecapData } from '@/lib/recap';
import { todayString } from '@/lib/stats';
import RecapRecordCard from './RecapRecordCard';
import RecapScoreCard from './RecapScoreCard';

const NUM = "'Outfit', sans-serif";
const ZEN = "'Zen Maru Gothic', sans-serif";
const SWIPE_THRESHOLD = 78; // めくりが確定するドラッグ距離(px)

type Slide = { type: 'record'; index: number } | { type: 'score' } | { type: 'summary' };

type Props = { open: boolean; data: RecapData | null; onClose: () => void };

export default function DailyRecap({ open, data, onClose }: Props) {
  const [i, setI] = useState(0);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, dragging: false });
  const [fling, setFling] = useState({ fx: 0, fy: 0 });

  const start = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  const reset = useCallback(() => {
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; }
    setI(0);
    setDrag({ dx: 0, dy: 0, dragging: false });
    setFling({ fx: 0, fy: 0 });
  }, []);

  // 開くたびに先頭へ戻す & 背面スクロールをロック
  useEffect(() => {
    if (!open) return;
    reset();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, reset]);

  // Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !data) return null;

  const slides: Slide[] = [
    ...data.records.map((_, index): Slide => ({ type: 'record', index })),
    { type: 'score' },
    { type: 'summary' },
  ];
  const total = slides.length;
  const lastIndex = total - 1;

  // ── ドラッグ ──────────────────────────────────────────────────────────────
  const onPointerDown = (e: PointerEvent) => {
    if (i >= lastIndex) return; // 最後（サマリー）カードはめくれない
    start.current = { x: e.clientX, y: e.clientY };
    last.current = { x: e.clientX, y: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setDrag({ dx: 0, dy: 0, dragging: true });
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.dragging) return;
    last.current = { x: e.clientX, y: e.clientY };
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      setDrag((d) => ({ ...d, dx: last.current.x - start.current.x, dy: last.current.y - start.current.y }));
    });
  };
  const onPointerUp = () => {
    if (!drag.dragging) return;
    if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; }
    const { dx, dy } = drag;
    const dist = Math.hypot(dx, dy);
    if (dist > SWIPE_THRESHOLD && i < lastIndex) {
      const s = 1100 / (dist || 1);
      setFling({ fx: dx * s, fy: dy * s });
      setI((v) => v + 1);
    }
    setDrag({ dx: 0, dy: 0, dragging: false });
  };

  // ── カードのスタイル（深さで重なりを表現） ──────────────────────────────────
  function cardStyle(k: number): CSSProperties {
    const depth = k - i;
    if (depth === 0) {
      const rot = drag.dragging ? drag.dx * 0.05 : 0;
      return {
        transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${rot}deg)`,
        opacity: 1,
        zIndex: 100,
        transition: drag.dragging ? 'none' : 'transform .42s cubic-bezier(.22,1,.36,1)',
      };
    }
    if (depth < 0) {
      return {
        transform: `translate(${fling.fx}px, ${fling.fy}px) rotate(${fling.fx * 0.04}deg)`,
        opacity: 0,
        zIndex: 100 - depth,
        pointerEvents: 'none',
        transition: 'transform .5s cubic-bezier(.25,.6,.3,1), opacity .45s ease',
      };
    }
    const d = Math.min(depth, 3);
    return {
      transform: `translateY(${d * 14}px) scale(${(1 - d * 0.05).toFixed(3)})`,
      opacity: depth <= 2 ? 1 : 0,
      zIndex: 100 - depth,
      pointerEvents: 'none',
      transition: 'transform .42s cubic-bezier(.22,1,.36,1), opacity .42s ease',
    };
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col items-center"
      style={{
        background: 'rgba(34,24,46,0.62)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        fontFamily: ZEN,
        padding: 'calc(env(safe-area-inset-top) + 20px) 20px calc(env(safe-area-inset-bottom) + 16px)',
      }}
    >
      {/* ── ヘッダー（常駐） ── */}
      <div className="w-full flex items-start justify-between" style={{ maxWidth: 360 }}>
        <div>
          <div style={{ font: "500 12px 'Zen Maru Gothic'", color: 'rgba(255,255,255,.85)', letterSpacing: '.05em' }}>
            {data.date === todayString() ? '今日のふり返り' : 'この日のふり返り'}
          </div>
          <div style={{ font: "700 18px 'Zen Maru Gothic'", color: '#fff', marginTop: 2 }}>
            {data.dateLabel}
          </div>
        </div>
        <button
          type="button" onClick={onClose} aria-label="閉じる"
          className="flex items-center justify-center flex-none"
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.16)', color: '#fff' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      {/* ── カードスタック ── */}
      <div className="relative w-full" style={{ maxWidth: 330, flex: '1 1 auto', maxHeight: 564, marginTop: 22, marginBottom: 16 }}>
        {slides.map((slide, k) => {
          const isTop = k === i;
          return (
            <div
              key={k}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
              onPointerCancel={isTop ? onPointerUp : undefined}
              className="absolute inset-0 overflow-hidden"
              style={{
                ...cardStyle(k),
                borderRadius: 30,
                boxShadow: '0 28px 54px -22px rgba(40,28,55,.6)',
                cursor: isTop && k < lastIndex ? 'grab' : 'default',
                touchAction: 'none',
                transformOrigin: 'center top',
              }}
            >
              {slide.type === 'record' && <RecapRecordCard rec={data.records[slide.index]} />}
              {slide.type === 'score' && <RecapScoreCard data={data} active={isTop} />}
              {slide.type === 'summary' && <SummaryCard data={data} />}
            </div>
          );
        })}
      </div>

      {/* ── フッター ── */}
      <div className="flex flex-col items-center flex-none" style={{ gap: 12, minHeight: 46 }}>
        <div className="flex items-center" style={{ gap: 6 }}>
          {slides.map((_, k) => (
            <span
              key={k}
              style={{
                height: 7,
                width: k === i ? 18 : 7,
                borderRadius: 4,
                background: k === i ? '#fff' : k < i ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.35)',
                transition: 'width .32s ease, background .32s ease',
              }}
            />
          ))}
        </div>
        {i < lastIndex ? (
          <div className="flex items-center" style={{ gap: 8 }}>
            <span style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid rgba(255,255,255,.85)', animation: 'recapBob 1.8s ease-in-out infinite' }} />
            <span style={{ font: "500 12.5px 'Zen Maru Gothic'", color: 'rgba(255,255,255,.85)' }}>スワイプしてめくる</span>
          </div>
        ) : (
          <button
            type="button" onClick={reset}
            style={{ cursor: 'pointer', font: "600 13.5px 'Zen Maru Gothic'", color: '#3b3340', background: '#fff', padding: '11px 26px', borderRadius: 30, boxShadow: '0 10px 22px -10px rgba(0,0,0,.4)' }}
          >
            もう一度見る
          </button>
        )}
      </div>

      <style>{`@keyframes recapBob{0%,100%{transform:translateY(0);opacity:.55}50%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  );
}

// ── サマリー（最終カード = モックの締め） ──────────────────────────────────────
function SummaryCard({ data }: { data: RecapData }) {
  const { summary } = data;
  const tiles = [
    { v: summary.intake.toLocaleString(), k: '摂取 kcal', bg: '#f7eef3' },
    { v: summary.burned.toLocaleString(), k: '運動 kcal', bg: '#eef5f0' },
    { v: String(summary.mealCount), k: '食事の記録', bg: '#f1eef7' },
    { v: String(summary.exerciseCount), k: '運動の記録', bg: '#f6f1ea' },
  ];

  return (
    <div
      className="h-full flex flex-col select-none"
      style={{ background: 'linear-gradient(165deg,#fffdfb,#f7eef3)', padding: '30px 26px' }}
    >
      <div style={{ font: "500 12px 'Zen Maru Gothic'", color: '#cc99aa', letterSpacing: '.12em' }}>DAY SUMMARY</div>
      <div style={{ font: "700 23px 'Zen Maru Gothic'", color: '#3b3340', marginTop: 7 }}>今日もよく頑張りました</div>

      <div className="grid grid-cols-2" style={{ gap: 10, marginTop: 24 }}>
        {tiles.map((t) => (
          <div key={t.k} style={{ background: t.bg, borderRadius: 18, padding: '16px 12px' }}>
            <div style={{ fontFamily: NUM, fontWeight: 700, fontSize: 25, color: '#3b3340' }}>{t.v}</div>
            <div style={{ font: "500 11px 'Zen Maru Gothic'", color: '#9c8fa6', marginTop: 3 }}>{t.k}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', font: "500 13px 'Zen Maru Gothic'", color: '#9c8fa6', lineHeight: 1.7 }}>
        {summary.mealCount}食・{summary.exerciseCount}つの運動を記録できました。<br />
        ゆっくり休んで、また明日。
      </div>
    </div>
  );
}
