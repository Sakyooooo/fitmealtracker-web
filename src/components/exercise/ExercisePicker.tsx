'use client';

import { useState, useEffect, useRef } from 'react';
import { GYM_PRESETS, estimateExerciseCalories } from '@/lib/activities';
import { ExerciseEntry } from '@/lib/types';
import { todayString } from '@/lib/stats';
import ActivityIcon from './ActivityIcon';

type Props = {
  onAdd: (data: Omit<ExerciseEntry, 'id'>) => void;
};

type Phase =
  | { type: 'idle' }
  | { type: 'timing'; name: string; startedAt: number };

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ExercisePicker({ onAdd }: Props) {
  const [phase, setPhase] = useState<Phase>({ type: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase.type === 'timing') {
      intervalRef.current = setInterval(
        () => setElapsed(Math.floor((Date.now() - phase.startedAt) / 1000)),
        500,
      );
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setElapsed(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase]);

  function save(p: { name: string; startedAt: number }) {
    // eslint-disable-next-line react-hooks/purity
    const durationMin = Math.max(1, Math.round((Date.now() - p.startedAt) / 60000));
    onAdd({
      name: p.name,
      durationMinutes: durationMin,
      caloriesBurned: estimateExerciseCalories(p.name, durationMin),
      date: todayString(),
      note: '',
      type: 'gymSession',
    });
  }

  function handleSelect(name: string) {
    if (phase.type === 'timing') {
      if (phase.name === name) return; // 同じ種目なら無視
      save(phase);                     // 現在の種目を保存
    }
    // eslint-disable-next-line react-hooks/purity
    setPhase({ type: 'timing', name, startedAt: Date.now() });
  }

  function handleDone() {
    if (phase.type !== 'timing') return;
    save(phase);
    setPhase({ type: 'idle' });
  }

  return (
    <div className="rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden bg-white">

      {/* ── Active timer bar ── */}
      {phase.type === 'timing' && (
        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between">
          <div className="min-w-0 mr-3">
            <p className="text-[9px] font-black text-white/40 tracking-widest uppercase">Now</p>
            <p className="text-white font-black text-sm truncate">{phase.name}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <p className="text-2xl font-black text-white tabular-nums leading-none">
              {fmt(elapsed)}
            </p>
            <button
              type="button"
              onClick={handleDone}
              className="px-4 py-2 bg-[#FF7043] text-white text-xs font-black rounded-xl
                         active:scale-95 transition-transform"
            >
              完了
            </button>
          </div>
        </div>
      )}

      {/* ── Label ── */}
      <div className="px-4 pt-3 pb-1">
        <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
          {phase.type === 'idle' ? '種目を選択' : '切り替え'}
        </p>
      </div>

      {/* ── Icon carousel ── */}
      <div
        className="flex gap-1 overflow-x-auto px-3 pb-3 pt-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {GYM_PRESETS.map((name) => {
          const isActive = phase.type === 'timing' && phase.name === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => handleSelect(name)}
              className={`flex flex-col items-center flex-shrink-0 w-[68px] pt-1.5 pb-2 rounded-xl
                          border-2 transition-all duration-150 gap-1
                          ${isActive
                            ? 'border-[#FF7043] bg-[#FFF3F0] shadow-sm'
                            : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}
            >
              <ActivityIcon name={name} size={52} />
              <span className={`text-[9px] font-semibold text-center leading-tight px-0.5 w-full
                ${isActive ? 'text-[#FF7043]' : 'text-gray-400'}`}>
                {name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
