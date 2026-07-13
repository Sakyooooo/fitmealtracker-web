'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { GymSession, GymGoalType, WorkoutSet } from '@/lib/types';
import { GYM_BG_URL, BG_OPACITY, HERO_FONT_SIZE, TIMER_FONT_SIZE } from '@/lib/constants';
import { GYM_PRESETS, estimateExerciseCalories } from '@/lib/activities';
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

/** 種目ごとの「前回の重量・セット・回数」記憶（詳細記録を1タップにするため） */
const LAST_SETS_KEY = 'fmt_gym_last_sets';

function loadLastSets(): Record<string, Omit<WorkoutSet, 'name'>> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LAST_SETS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveLastSets(sets: WorkoutSet[]): void {
  try {
    const store = loadLastSets();
    for (const s of sets) {
      store[s.name] = { weightKg: s.weightKg, sets: s.sets, reps: s.reps };
    }
    localStorage.setItem(LAST_SETS_KEY, JSON.stringify(store));
  } catch { /* quota */ }
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
  /** セッションを運動記録として保存（種目チェックと重量詳細はオプション） */
  onSave: (calories: number, sets: WorkoutSet[], performed: string[]) => void;
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
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([]);
  const [newSet, setNewSet] = useState<WorkoutSet>({ name: '', weightKg: 0, sets: 3, reps: 10 });
  const [showSetForm, setShowSetForm] = useState(false);
  const [demoClip, setDemoClip] = useState<ExerciseClip>('idle'); // アバターが実演中の種目
  // セッション中に「やった」とチェックした種目（計測はしない。完了画面に引き継がれる）
  const [performed, setPerformed] = useState<string[]>([]);
  const [customExercises, setCustomExercises] = useState<string[]>([]);
  const [lastSets, setLastSets] = useState(loadLastSets);
  const prefilledRef = useRef(false); // カロリー自動プレフィルを1回に留める
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // セッションが変わったら（保存/キャンセル後や新規開始）、種目まわりの状態をリセット。
  // これを怠ると前回セッションのチェック・重量詳細が次のセッションへ持ち越される。
  useEffect(() => {
    const id = session?.id ?? null;
    if (id === sessionIdRef.current) return;
    sessionIdRef.current = id;
    setPerformed([]);
    setCustomExercises([]);
    setWorkoutSets([]);
    setCalories('');
    setShowSetForm(false);
    setDemoClip('idle');
    setLastSets(loadLastSets()); // 直前のセッションで保存した「前回」を反映
    prefilledRef.current = false;
  }, [session?.id]);

  // ── 種目チェック（タップでオン/オフ。アバターは最後にオンにした種目を実演） ────
  function toggleExercise(name: string) {
    setPerformed((prev) => {
      if (prev.includes(name)) {
        // オフにした種目を実演中なら待機へ戻す
        if (EXERCISE_CLIP[name] === demoClip || prev[prev.length - 1] === name) setDemoClip('idle');
        return prev.filter((n) => n !== name);
      }
      setDemoClip(EXERCISE_CLIP[name] ?? 'idle');
      return [...prev, name];
    });
  }

  function addCustomExercise() {
    // プリセットに無い種目もチェックの対象にできるようにする
    const name = window.prompt('種目名を入力')?.trim();
    if (!name) return;
    if (!GYM_PRESETS.includes(name) && !customExercises.includes(name)) {
      setCustomExercises((prev) => [...prev, name]);
    }
    if (!performed.includes(name)) {
      setPerformed((prev) => [...prev, name]);
      setDemoClip(EXERCISE_CLIP[name] ?? 'idle');
    }
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

  // ── カロリー自動プレフィル（完了画面に入ったとき1回だけ。修正は自由） ─────────
  const durationMin = Math.max(1, Math.round((session?.durationSec ?? 0) / 60));
  const estimatedKcal = estimateExerciseCalories('ジムセッション', durationMin);
  useEffect(() => {
    if (session?.status === 'completed' && !prefilledRef.current) {
      prefilledRef.current = true;
      setCalories(String(estimatedKcal));
    }
    if (session?.status !== 'completed') prefilledRef.current = false;
  }, [session?.status, estimatedKcal]);

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
    const sessionExercises = [...GYM_PRESETS, ...customExercises];

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

            {/* ── アバターステージ（チェックした種目を実演。操作は必須ではない） ── */}
            <div className="flex-1 w-full min-h-[250px] relative">
              <ExerciseAvatarStage clip={demoClip} className="absolute inset-0" />
            </div>

            {/* ── 種目チップ（やった種目をタップでチェック。任意・計測なし） ── */}
            <p className="w-full text-[10px] font-bold text-gray-400 mb-1.5">
              やった種目をタップ（任意・あとからでもOK）
            </p>
            <div className="w-full flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {sessionExercises.map((name) => {
                const active = performed.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleExercise(name)}
                    className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border transition-colors ${
                      active
                        ? 'bg-[#FF7043] border-[#FF7043] text-white shadow-sm'
                        : 'bg-white/80 border-gray-200 text-gray-600 hover:border-[#FF7043] hover:text-[#FF7043]'
                    }`}
                  >
                    {active ? '✓ ' : ''}{name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={addCustomExercise}
                className="shrink-0 px-3.5 py-2 rounded-full text-xs font-bold border border-dashed border-gray-300 text-gray-400 bg-white/80"
              >
                ＋その他
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center pb-6 pt-3 gap-4">
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
  // 種目リスト = セッション中のチェック ＋ 完了画面で追加した詳細（重複なし）
  const listedNames = [...performed];
  for (const s of workoutSets) if (!listedNames.includes(s.name)) listedNames.push(s.name);

  function openSetForm(name: string) {
    const last = lastSets[name];
    setNewSet({ name, weightKg: last?.weightKg ?? 0, sets: last?.sets ?? 3, reps: last?.reps ?? 10 });
    setShowSetForm(true);
  }

  function applyLast(name: string) {
    const last = lastSets[name];
    if (!last) return;
    setWorkoutSets((prev) => [
      ...prev.filter((s) => s.name !== name),
      { name, weightKg: last.weightKg, sets: last.sets, reps: last.reps },
    ]);
  }

  function removeExercise(name: string) {
    setPerformed((prev) => prev.filter((n) => n !== name));
    setWorkoutSets((prev) => prev.filter((s) => s.name !== name));
  }

  function handleSave() {
    // 未入力・不正値は自動推定値で保存（入力を強制しない）
    const parsed = parseInt(calories, 10);
    const kcal = Number.isNaN(parsed) || parsed < 0 ? estimatedKcal : parsed;
    saveLastSets(workoutSets);
    onSave(kcal, workoutSets, listedNames);
  }

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

          {/* 消費カロリー（時間から自動推定・そのまま保存OK） */}
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
            <p className="text-[10px] font-bold text-gray-400 text-center mt-1.5">
              時間から自動推定しました。そのまま保存でOK・修正も自由です
            </p>
          </div>

          {/* 種目記録（チェック済みが並ぶ。重量・回数は任意） */}
          <div className="w-full max-w-xs mx-auto mb-4">
            <p className="text-xs font-bold tracking-widest text-gray-400 mb-2">種目（任意）</p>

            {listedNames.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {listedNames.map((name) => {
                  const detail = workoutSets.find((s) => s.name === name);
                  const last = lastSets[name];
                  return (
                    <div key={name} className="flex items-center gap-2 bg-white/80 border border-gray-100 rounded-xl px-3 py-2">
                      <span className="text-sm font-bold text-gray-800 flex-1 min-w-0 truncate">{name}</span>
                      {detail ? (
                        <button
                          type="button"
                          onClick={() => openSetForm(name)}
                          className="text-xs text-gray-500 font-medium"
                        >
                          {detail.weightKg}kg × {detail.sets}セット × {detail.reps}回
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {last && (
                            <button
                              type="button"
                              onClick={() => applyLast(name)}
                              className="px-2 py-1 rounded-full border border-[#FF7043]/40 text-[#FF7043] text-[10px] font-bold hover:bg-[#FFF3F0]"
                            >
                              前回: {last.weightKg}kg×{last.sets}×{last.reps}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openSetForm(name)}
                            className="px-2 py-1 rounded-full border border-gray-200 text-gray-400 text-[10px] font-bold"
                          >
                            詳細
                          </button>
                        </div>
                      )}
                      <button type="button" onClick={() => removeExercise(name)}
                        className="text-gray-300 hover:text-gray-500 text-lg leading-none flex-shrink-0">×</button>
                    </div>
                  );
                })}
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
                      const name = newSet.name.trim();
                      if (!name) return;
                      setWorkoutSets((prev) => [...prev.filter((s) => s.name !== name), { ...newSet, name }]);
                      if (!performed.includes(name)) setPerformed((prev) => [...prev, name]);
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
                onClick={() => { setNewSet({ name: '', weightKg: 0, sets: 3, reps: 10 }); setShowSetForm(true); }}
                className="w-full py-2.5 rounded-xl border border-dashed border-gray-200 text-sm font-bold text-gray-400 flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                種目を追加
              </button>
            )}
            <p className="text-[10px] text-gray-400 mt-2">
              重量・回数はあとから運動リストでも確認できます（メモに残ります）
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center pb-6 gap-4">
          <div className="flex items-center gap-8">
            <button type="button" onClick={onCancel}
              className="w-14 h-14 rounded-full bg-white/80 border border-gray-200 flex items-center justify-center shadow-sm">
              <span className="text-gray-500 font-bold text-xl">×</span>
            </button>
            <button type="button"
              onClick={handleSave}
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
