'use client';

import { useEffect, useState } from 'react';
import { RecapData } from '@/lib/recap';

const NUM = "'Outfit', sans-serif";
const R = 78;
const CIRC = 2 * Math.PI * R;

// スコア帯をモックのパレットへ（高:ミント / 中:ピーチ / 低:ラベンダー）
function ringColor(total: number): string {
  if (total >= 75) return '#86cdab';
  if (total >= 50) return '#ef9f7e';
  return '#c0a9e6';
}

export default function RecapScoreCard({ data, active }: { data: RecapData; active: boolean }) {
  const { score, streak } = data;
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!active) { setAnimated(false); return; }
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, [active]);

  const col = ringColor(score.total);
  const offset = animated ? CIRC * (1 - score.total / 100) : CIRC;

  return (
    <div
      className="h-full flex flex-col select-none"
      style={{ background: 'linear-gradient(165deg,#fffdfb,#f7eef3)', padding: '30px 26px' }}
    >
      <div style={{ font: "500 12px 'Zen Maru Gothic'", color: '#cc99aa', letterSpacing: '.12em' }}>
        HEALTH SCORE
      </div>
      <div style={{ font: "700 23px 'Zen Maru Gothic'", color: '#3b3340', marginTop: 7 }}>
        今日の健康スコア
      </div>

      {/* ── リング ── */}
      <div className="relative mx-auto" style={{ width: 188, height: 188, marginTop: 14 }}>
        <svg width="188" height="188" viewBox="0 0 188 188">
          <circle cx="94" cy="94" r={R} fill="none" stroke="#f0e8ef" strokeWidth="14" />
          <circle
            cx="94" cy="94" r={R} fill="none"
            stroke={col} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={offset}
            transform="rotate(-90 94 94)"
            style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span style={{ fontFamily: NUM, fontWeight: 700, fontSize: 52, color: '#3b3340', lineHeight: 1 }}>
            {score.total}
          </span>
          <span style={{ font: "500 11px 'Zen Maru Gothic'", color: '#9c8fa6', letterSpacing: '.1em' }}>
            / 100
          </span>
        </div>
      </div>

      <div style={{ font: "700 17px 'Zen Maru Gothic'", color: '#3b3340', textAlign: 'center', marginTop: 6 }}>
        {score.message}
      </div>

      {streak > 0 && (
        <div className="mx-auto flex items-center" style={{ gap: 6, marginTop: 10, padding: '6px 14px', borderRadius: 30, background: '#fbf3df' }}>
          <span style={{ fontSize: 13 }}>🔥</span>
          <span style={{ font: "600 12px 'Zen Maru Gothic'", color: '#b08968' }}>{streak}日連続で記録中</span>
        </div>
      )}

      {/* ── 内訳バー ── */}
      <div style={{ marginTop: 'auto', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {score.breakdown.map((b) => (
          <div key={b.key} className="flex items-center" style={{ gap: 10 }}>
            <span style={{ width: 62, flex: 'none', font: "500 12px 'Zen Maru Gothic'", color: '#9c8fa6' }}>{b.label}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 6, background: '#f0e8ef', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 6, width: animated ? `${b.pct}%` : '0%', background: col, transition: 'width .9s cubic-bezier(.22,1,.36,1)' }} />
            </div>
            <span style={{ width: 28, textAlign: 'right', fontFamily: NUM, fontWeight: 600, fontSize: 12, color: '#6b6470' }}>{b.pct}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
