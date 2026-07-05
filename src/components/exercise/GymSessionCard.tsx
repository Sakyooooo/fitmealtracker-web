'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ExerciseEntry, GymSession, GymGoalType, WorkoutSet } from '@/lib/types';
import { GYM_BG_URL, BG_OPACITY, HERO_FONT_SIZE, TIMER_FONT_SIZE } from '@/lib/constants';
import { GYM_PRESETS, estimateExerciseCalories } from '@/lib/activities';
import { todayString } from '@/lib/stats';
import type { ExerciseClip } from './ExerciseAvatarStage';

// three.js を含むため遅延読み込み（セッション開始時にのみロード）
const ExerciseAvatarStage = dynamic(() => import('./ExerciseAvatarStage'), { ssr: false, loading: () => null });

/**
 * 種目名 → アバターの実演クリップ。近い動きで代用（完全一致がない種目は待機）。
 * クリップは public/models/exercise_avatar.glb（scripts/build_exercise_avatar_glb.py）と対応。
 */
const EXERCISE_CLIP: Record<string, ExerciseClip> = {
  'スクワット': 'squat',
  'レッグプレス': 'squat',
  'ランジ': 'squat',
  'デッドリフト': 'squat',
  'ベンチプレス': 'pushup',
  'ダンベルフライ': 'pushup',
  'プランク': 'pushup',
  'トライセップディップ': 'pushup',
  '腕立て伏せ': 'pushup',
  'クランチ': 'crunch',
  '腹筋': 'situps',
  'ランニング': 'run',
  'ジョギング': 'run',
  'ウォーキング': 'walk',
};

/** 種目ごとの計測状態（タップで開始、切替で前の種目を自動保存） */
type ExerciseTiming = { name: string; startedAt: number };

function fmtShort(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

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
  onSave: (calories: number, sets: WorkoutSet[]) => void;
  /** 種目タイマーで計測した1種目ぶんを ExerciseEntry として保存する */
  onAddExercise: (data: Omit<ExerciseEntry, 'id'>) => void;
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
  onStart, onEnd, onCancel, onMemoChange, onSave, onAddExercise, onAddManual, onGoalSetting,
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [calories, setCalories] = useState('');
  const [showMemo, setShowMemo] = useState(false);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([]);
  const [newSet, setNewSet] = useState<WorkoutSet>({ name: '', weightKg: 0, sets: 3, reps: 10 });
  const [showSetForm, setShowSetForm] = useState(false);
  const [demoClip, setDemoClip] = useState<ExerciseClip>('idle'); // アバターが実演中の種目
  const [timing, setTiming] = useState<ExerciseTiming | null>(null); // 計測中の種目
  const [exElapsed, setExElapsed] = useState(0);
  const [performed, setPerformed] = useState<string[]>([]); // セッション中に行った種目名（完了画面の種目記録プリフィル用）
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 種目タイマー（チップで開始・切替・完了。切替時は前の種目を自動保存） ──────
  useEffect(() => {
    if (timing) {
      const t = timing;
      setExElapsed(Math.floor((Date.now() - t.startedAt) / 1000));
      exIntervalRef.current = setInterval(
        () => setExElapsed(Math.floor((Date.now() - t.startedAt) / 1000)),
        500,
      );
    } else {
      if (exIntervalRef.current) clearInterval(exIntervalRef.current);
      setExElapsed(0);
    }
    return () => { if (exIntervalRef.current) clearInterval(exIntervalRef.current); };
  }, [timing]);

  function saveTiming(t: ExerciseTiming) {
    // eslint-disable-next-line react-hooks/purity
    const durationMin = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
    onAddExercise({
      name: t.name,
      durationMinutes: durationMin,
      caloriesBurned: estimateExerciseCalories(t.name, durationMin),
      date: todayString(),
      note: '',
      type: 'gymSession',
    });
    setPerformed((prev) => (prev.includes(t.name) ? prev : [...prev, t.name]));
  }

  function handleExerciseTap(name: string) {
    if (timing?.name === name) return; // 同じ種目は無視（終わるときは「完了」）
    if (timing) saveTiming(timing);    // 前の種目を保存して切替
    // eslint-disable-next-line react-hooks/purity
    setTiming({ name, startedAt: Date.now() });
    setDemoClip(EXERCISE_CLIP[name] ?? 'idle');
  }

  function handleExerciseDone() {
    if (!timing) return;
    saveTiming(timing);
    setTiming(null);
    setDemoClip('idle');
  }

  /** セッション終了。計測中の種目が残っていれば保存してから終える。 */
  function handleEnd() {
    if (timing) {
      saveTiming(timing);
      setTiming(null);
      setDemoClip('idle');
    }
    onEnd();
  }

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

          <div className="flex-1 flex flex-col items-center px-4 min-h-0">
            <p
              className="font-black tabular-nums leading-none tracking-tighter text-gray-900"
              style={{ fontSize: 'clamp(40px, 12vw, 64px)' }}
            >
              {formatElapsed(elapsed)}
            </p>
            <p className="text-xs font-bold tracking-[0.2em] text-gray-400 mt-1.5">
              {formatTime(session.startedAt)} START
            </p>
            {gymGoal && <ProgressBar pct={activePct} />}

            {/* ── アバターステージ（計測中の種目を実演） ── */}
            <div className="flex-1 w-full min-h-[250px] relative">
              <ExerciseAvatarStage clip={demoClip} className="absolute inset-0" />

              {/* 計測中バー（種目名・経過時間・完了） */}
              {timing && (
                <div className="absolute top-1 left-0 right-0 flex justify-center pointer-events-none">
                  <div className="pointer-events-auto flex items-center gap-3 bg-gray-900/90 rounded-full pl-4 pr-1.5 py-1.5 shadow-lg">
                    <span className="text-white font-black text-xs truncate max-w-[110px]">{timing.name}</span>
                    <span className="text-white/90 font-black text-sm tabular-nums">{fmtShort(exElapsed)}</span>
                    <button
                      type="button"
                      onClick={handleExerciseDone}
                      className="px-3 py-1.5 bg-[#FF7043] text-white text-[11px] font-black rounded-full active:scale-95 transition-transform"
                    >
                      完了
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── 種目チップ（タップで計測開始。別の種目にタップすると前の種目を自動保存して切替） ── */}
            <div className="w-full flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {GYM_PRESETS.map((name) => {
                const active = timing?.name === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleExerciseTap(name)}
                    className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${
                      active
                        ? 'bg-[#FF7043] border-[#FF7043] text-white shadow-sm'
                        : 'bg-white/80 border-gray-200 text-gray-600 hover:border-[#FF7043] hover:text-[#FF7043]'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col items-center pb-6 pt-3 gap-4">
            <div className="flex items-center gap-8">
              <button type="button" onClick={onCancel}
                className="w-14 h-14 rounded-full bg-white/80 border border-gray-200 flex items-center justify-center shadow-sm">
                <span className="text-gray-500 font-bold text-xl">×</span>
              </button>
              <button type="button" onClick={handleEnd}
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

        <div className="flex-1 flex flex-col px-4 overflow-y-auto">
          {/* タイマー表示 */}
          <div className="flex flex-col items-center pt-4 pb-4">
            <p
              className="font-black tabular-nums leading-none tracking-tighter text-gray-900"
              style={{ fontSize: TIMER_FONT_SIZE }}
            >
              {formatElapsed(session.durationSec ?? 0)}
            </p>
            <div className="w-44 h-[2px] bg-gray-900 mt-3 mb-4" />
          </div>

          {/* 消費カロリー */}
          <div className="w-full max-w-xs mx-auto mb-4">
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

          {/* 種目記録 */}
          <div className="w-full max-w-xs mx-auto mb-4">
            <p className="text-xs font-bold tracking-widest text-gray-400 mb-2">種目記録（任意）</p>

            {/* セッション中に計測した種目 → タップで重量/回数の入力フォームへプリフィル */}
            {performed.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold text-gray-400 mb-1.5">セッション中の種目（タップで詳細を記録）</p>
                <div className="flex gap-1.5 flex-wrap">
                  {performed.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setNewSet({ name, weightKg: 0, sets: 3, reps: 10 });
                        setShowSetForm(true);
                      }}
                      className="px-2.5 py-1.5 bg-white/80 border border-[#FF7043]/40 text-[#FF7043] text-[11px] font-bold rounded-full hover:bg-[#FFF3F0]"
                    >
                      ＋ {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {workoutSets.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {workoutSets.map((s, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/80 border border-gray-100 rounded-xl px-3 py-2">
                    <span className="text-sm font-bold text-gray-800">{s.name}</span>
                    <span className="text-xs text-gray-500 font-medium">
                      {s.weightKg}kg × {s.sets}セット × {s.reps}回
                    </span>
                    <button type="button" onClick={() => setWorkoutSets((prev) => prev.filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-gray-500 ml-2 text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
            {showSetForm ? (
              <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
                <input
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none placeholder:text-gray-300"
                  placeholder="種目名（例: ベンチプレス）"
                  value={newSet.name}
                  onChange={(e) => setNewSet((p) => ({ ...p, name: e.target.value }))}
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 mb-1 tracking-widest">重量(kg)</p>
                    <input type="number" min={0} step={0.5}
                      className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm font-black text-center text-gray-900 focus:outline-none"
                      value={newSet.weightKg}
                      onChange={(e) => setNewSet((p) => ({ ...p, weightKg: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 mb-1 tracking-widest">セット</p>
                    <input type="number" min={1}
                      className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm font-black text-center text-gray-900 focus:outline-none"
                      value={newSet.sets}
                      onChange={(e) => setNewSet((p) => ({ ...p, sets: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 mb-1 tracking-widest">回数</p>
                    <input type="number" min={1}
                      className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2 text-sm font-black text-center text-gray-900 focus:outline-none"
                      value={newSet.reps}
                      onChange={(e) => setNewSet((p) => ({ ...p, reps: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setShowSetForm(false)}
                    className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-400">
                    キャンセル
                  </button>
                  <button type="button"
                    onClick={() => {
                      if (!newSet.name.trim()) return;
                      setWorkoutSets((prev) => [...prev, newSet]);
                      setNewSet({ name: '', weightKg: 0, sets: 3, reps: 10 });
                      setShowSetForm(false);
                    }}
                    className="flex-1 py-2 rounded-xl bg-[#FF7043] text-white text-sm font-black">
                    追加
                  </button>
                </div>
              </div>
            ) : (
              <button type="button"
                onClick={() => setShowSetForm(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 text-sm font-bold text-gray-400 flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                種目を追加
              </button>
            )}
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
                onSave(kcal, workoutSets);
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
