'use client';

import { useEffect, useRef, useState } from 'react';
import { GymSession, GymGoalType } from '@/lib/types';
import { GYM_BG_URL, BG_OPACITY, HERO_FONT_SIZE, TIMER_FONT_SIZE } from '@/lib/constants';

export type GymGoal = { type: GymGoalType; value: number };

interface Props {
  session: GymSession | null;
  todayBurned: number;
  todayMinutes: number;
  gymGoal?: GymGoal;
  onStart: () => void;
  onEnd: () => void;
  onCancel: () => void;
  onMemoChange: (memo: string) => void;
  onSave: (calories: number) => void;
  onAddManual?: () => void;
  onGoalSetting?: () => void;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '00')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 進捗バー (0〜100%) */
function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const done = clamped >= 100;
  return (
    <div className="w-44 h-1.5 bg-gray-200 rounded-full mt-4 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${done ? 'bg-green-500' : 'bg-[#FF7043]'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default function GymSessionCard({
  session, todayBurned, todayMinutes, gymGoal,
  onStart, onEnd, onCancel, onMemoChange, onSave, onAddManual, onGoalSetting,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [calories, setCalories] = useState('');
  const [showMemo, setShowMemo] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (session?.status === 'active') {
      const base = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
      setElapsed(base);
      intervalRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (session?.status === 'completed') setElapsed(session.durationSec ?? 0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [session?.status, session?.startedAt, session?.durationSec]);

  const minHeight = 'calc(100svh - 130px)';

  // 表示する数値とラベルをゴール種別で切り替え
  const displayValue = gymGoal?.type === 'time' ? todayMinutes : todayBurned;
  const displayUnit  = gymGoal?.type === 'time' ? 'MIN TODAY' : 'KCAL BURNED TODAY';
  const progressPct  = gymGoal ? (displayValue / gymGoal.value) * 100 : 0;
  const goalLabel    = gymGoal
    ? `${gymGoal.value}${gymGoal.type === 'time' ? ' 分' : ' kcal'}`
    : null;

  // ── Idle ────────────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="flex flex-col relative overflow-hidden" style={{ minHeight }}>
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none select-none"
          style={{ backgroundImage: `url(${GYM_BG_URL})`, opacity: 0 }}
        />
        <div className="relative z-10 flex flex-col flex-1">
          {/* Header */}
          <div className="px-4 pt-4 pb-2">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">ジム</h1>
            <div className="flex gap-3 mt-1 items-center">
              <span className="text-sm font-bold text-gray-900">クイックスタート</span>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={onGoalSetting}
                className="text-sm font-bold text-gray-900 flex items-center gap-1.5"
              >
                {goalLabel ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#FF7043] inline-block" />
                    <span>{goalLabel}</span>
                  </>
                ) : (
                  <span className="text-gray-400">目標設定</span>
                )}
              </button>
            </div>
          </div>

          {/* Big metric */}
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {/* Number — with or without goal denominator */}
            <div className="flex items-baseline gap-2">
              <p
                className="font-black italic leading-none tracking-tighter text-gray-900 tabular-nums"
                style={{ fontSize: HERO_FONT_SIZE }}
              >
                {displayValue}
              </p>
              {gymGoal && (
                <p
                  className="font-black italic text-gray-300 tabular-nums leading-none"
                  style={{ fontSize: 'clamp(32px, 10vw, 52px)' }}
                >
                  / {gymGoal.value}
                </p>
              )}
            </div>
            <div className="w-44 h-[2px] bg-gray-900 mt-3 mb-3" />
            <p className="text-sm font-bold tracking-[0.2em] text-gray-500">{displayUnit}</p>
            {/* Progress bar only when goal is set */}
            {gymGoal && <ProgressBar pct={progressPct} />}
            {gymGoal && progressPct >= 100 && (
              <p className="text-xs font-black text-green-500 mt-2 tracking-widest">GOAL REACHED 🎉</p>
            )}
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center pb-6 gap-4">
            <div className="flex items-center gap-8">
              <button
                type="button" onClick={onAddManual}
                className="w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200
                           flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <button
                type="button" onClick={onStart}
                className="w-28 h-28 rounded-full bg-[#FF7043] flex items-center justify-center
                           shadow-xl active:scale-95 transition-transform"
              >
                <span className="text-white font-black text-base tracking-widest">START</span>
              </button>
              <div className="w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200
                              flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Active ───────────────────────────────────────────────────────────────────
  if (session.status === 'active') {
    const sessionMin = Math.floor(elapsed / 60);
    const activePct = gymGoal
      ? gymGoal.type === 'time'
        ? ((todayMinutes + sessionMin) / gymGoal.value) * 100
        : (todayBurned / gymGoal.value) * 100
      : 0;

    return (
      <div className="flex flex-col relative overflow-hidden" style={{ minHeight }}>
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none select-none"
          style={{ backgroundImage: `url(${GYM_BG_URL})`, opacity: BG_OPACITY }}
        />
        <div className="relative z-10 flex flex-col flex-1">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900">セッション</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-[#FF7043] animate-pulse" />
                <span className="text-xs font-black text-[#FF7043] tracking-widest">LIVE</span>
                {gymGoal && (
                  <span className="text-xs text-gray-400 ml-2">
                    目標: {goalLabel}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button" onClick={() => setShowMemo((v) => !v)}
              className="w-10 h-10 rounded-full bg-white/80 border border-gray-200 flex items-center justify-center text-gray-500"
            >
              ✎
            </button>
          </div>

          {showMemo && (
            <div className="px-4 mb-2">
              <textarea
                className="w-full bg-white/90 border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                           text-gray-700 focus:outline-none resize-none placeholder:text-gray-300"
                rows={2} placeholder="メモ（任意）"
                value={session.memo ?? ''} onChange={(e) => onMemoChange(e.target.value)}
              />
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <p
              className="font-black tabular-nums leading-none tracking-tighter text-gray-900"
              style={{ fontSize: TIMER_FONT_SIZE }}
            >
              {formatElapsed(elapsed)}
            </p>
            <div className="w-44 h-[2px] bg-gray-900 mt-3 mb-3" />
            <p className="text-sm font-bold tracking-[0.2em] text-gray-400">
              {formatTime(session.startedAt)} START
            </p>
            {gymGoal && <ProgressBar pct={activePct} />}
          </div>

          <div className="flex flex-col items-center pb-6 gap-4">
            <div className="flex items-center gap-8">
              <button type="button" onClick={onCancel}
                className="w-14 h-14 rounded-full bg-white/80 border border-gray-200 flex items-center justify-center shadow-sm">
                <span className="text-gray-500 font-bold text-xl">×</span>
              </button>
              <button type="button" onClick={onEnd}
                className="w-28 h-28 rounded-full bg-gray-900 flex items-center justify-center shadow-xl active:scale-95 transition-transform">
                <span className="text-white font-black text-lg tracking-wide">終了</span>
              </button>
              <div className="w-14 h-14" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Completed ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col relative overflow-hidden" style={{ minHeight }}>
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none select-none"
        style={{ backgroundImage: `url(${GYM_BG_URL})`, opacity: BG_OPACITY }}
      />
      <div className="relative z-10 flex flex-col flex-1">
        <div className="px-4 pt-4 pb-2">
          <h1 className="text-2xl font-black tracking-tight text-gray-900">完了</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatTime(session.startedAt)} — {session.endedAt ? formatTime(session.endedAt) : ''}
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <p
            className="font-black tabular-nums leading-none tracking-tighter text-gray-900"
            style={{ fontSize: TIMER_FONT_SIZE }}
          >
            {formatElapsed(session.durationSec ?? 0)}
          </p>
          <div className="w-44 h-[2px] bg-gray-900 mt-3 mb-6" />
          <div className="w-full max-w-xs">
            <p className="text-xs font-bold tracking-widest text-gray-400 text-center mb-2">
              消費カロリー（KCAL）
            </p>
            <input
              className="w-full text-center text-3xl font-black text-gray-900 bg-white/80
                         border border-gray-200 rounded-2xl px-4 py-4 focus:outline-none tabular-nums"
              type="number" placeholder="0" min={0}
              value={calories} onChange={(e) => setCalories(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col items-center pb-6 gap-4">
          <div className="flex items-center gap-8">
            <button type="button" onClick={onCancel}
              className="w-14 h-14 rounded-full bg-white/80 border border-gray-200 flex items-center justify-center shadow-sm">
              <span className="text-gray-500 font-bold text-xl">×</span>
            </button>
            <button type="button"
              onClick={() => {
                const kcal = parseInt(calories, 10);
                if (isNaN(kcal) || kcal < 0) { alert('消費カロリーを入力してください'); return; }
                onSave(kcal);
              }}
              className="w-28 h-28 rounded-full bg-[#FF7043] flex items-center justify-center shadow-xl active:scale-95 transition-transform">
              <span className="text-white font-black text-lg tracking-wide">保存</span>
            </button>
            <div className="w-14 h-14" />
          </div>
        </div>
      </div>
    </div>
  );
}
