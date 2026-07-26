'use client';

import { RecapRecord } from '@/lib/recap';

// 数字は Outfit、本文は Zen Maru Gothic（モックに準拠）
const NUM = "'Outfit', sans-serif";
const STRIPE =
  'repeating-linear-gradient(135deg,#ece1ea,#ece1ea 8px,#f4ebf1 8px,#f4ebf1 16px)';

function categoryEmoji(category: string): string {
  switch (category) {
    case '朝食': return '🍳';
    case '昼食': return '🍱';
    case '夕食': return '🍽️';
    case '間食': return '🍎';
    default: return '🍽️';
  }
}

export default function RecapRecordCard({ rec }: { rec: RecapRecord }) {
  const isMeal = rec.kind === 'meal';
  const hasPhoto = isMeal && !!rec.photoUrl;

  return (
    <div className="h-full flex flex-col bg-white select-none">
      {/* ── 写真 / ストライプのプレースホルダー ── */}
      <div
        className="relative flex-none flex items-center justify-center"
        style={{ height: 206, background: hasPhoto ? undefined : STRIPE }}
      >
        {hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rec.photoUrl} alt={rec.name} className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `${rec.photoFocusX ?? 50}% ${rec.photoFocusY ?? 50}%` }} />
        ) : (
          <span className="select-none" style={{ fontSize: 46, opacity: 0.55 }}>
            {isMeal ? categoryEmoji(rec.category) : '🏋️'}
          </span>
        )}

        <div className="absolute flex items-center" style={{ top: 14, left: 14, gap: 7 }}>
          <span style={{ font: "600 12px 'Zen Maru Gothic'", color: '#fff', background: 'rgba(60,48,70,.8)', padding: '5px 12px', borderRadius: 20 }}>
            {isMeal ? rec.category : '運動'}
          </span>
          {isMeal && (
            <span style={{ fontFamily: NUM, fontWeight: 600, fontSize: 12, color: '#fff', background: 'rgba(60,48,70,.5)', padding: '5px 10px', borderRadius: 20 }}>
              {rec.time}
            </span>
          )}
        </div>
      </div>

      {/* ── 本文 ── */}
      <div className="flex-1 flex flex-col" style={{ padding: '20px 22px 24px' }}>
        <div className="flex items-end justify-between" style={{ gap: 10 }}>
          <div className="min-w-0" style={{ font: "700 21px 'Zen Maru Gothic'", color: '#3b3340' }}>{rec.name}</div>
          <div className="text-right flex-none">
            <span style={{ fontFamily: NUM, fontWeight: 700, fontSize: 24, color: '#ef9f7e' }}>
              {rec.calories.toLocaleString()}
            </span>
            <span style={{ font: "500 12px 'Zen Maru Gothic'", color: '#9c8fa6' }}> kcal</span>
          </div>
        </div>

        {isMeal ? <PfcSection rec={rec} /> : <ExerciseStats rec={rec} />}

        {rec.note && (
          <div
            style={{ marginTop: 'auto', padding: '13px 15px', background: '#f8f4f1', borderRadius: 14, font: "500 13px 'Zen Maru Gothic'", color: '#8a8290', lineHeight: 1.6 }}
            className="line-clamp-3"
          >
            “{rec.note}”
          </div>
        )}
      </div>
    </div>
  );
}

function PfcSection({ rec }: { rec: Extract<RecapRecord, { kind: 'meal' }> }) {
  const p = rec.protein ?? 0;
  const f = rec.fat ?? 0;
  const c = rec.carbs ?? 0;
  if (p + f + c <= 0) return null;

  return (
    <div style={{ marginTop: 22 }}>
      <div className="flex overflow-hidden" style={{ height: 9, borderRadius: 6, background: '#f0e8ef' }}>
        <div style={{ flexGrow: p, background: '#ef9f7e' }} />
        <div style={{ flexGrow: f, background: '#c0a9e6' }} />
        <div style={{ flexGrow: c, background: '#86cdab' }} />
      </div>
      <div className="flex justify-between" style={{ marginTop: 11 }}>
        <Legend color="#ef9f7e" text={`P ${p}g`} />
        <Legend color="#c0a9e6" text={`F ${f}g`} />
        <Legend color="#86cdab" text={`C ${c}g`} />
      </div>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center" style={{ gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ font: "500 12.5px 'Zen Maru Gothic'", color: '#6b6470' }}>{text}</span>
    </div>
  );
}

function ExerciseStats({ rec }: { rec: Extract<RecapRecord, { kind: 'exercise' }> }) {
  return (
    <div className="flex" style={{ gap: 9, marginTop: 20 }}>
      <StatCell k="時間" v={`${rec.durationMinutes}分`} />
      <StatCell k="消費" v={`${rec.calories.toLocaleString()}kcal`} />
    </div>
  );
}

function StatCell({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ flex: 1, background: '#f6f1f4', borderRadius: 14, padding: '13px 8px', textAlign: 'center' }}>
      <div style={{ fontFamily: NUM, fontWeight: 700, fontSize: 16, color: '#3b3340' }}>{v}</div>
      <div style={{ font: "500 11px 'Zen Maru Gothic'", color: '#9c8fa6', marginTop: 3 }}>{k}</div>
    </div>
  );
}
