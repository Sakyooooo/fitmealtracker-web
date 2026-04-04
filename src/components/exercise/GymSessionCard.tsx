'use client';

import { useEffect, useRef, useState } from 'react';
import { GymSession } from '@/lib/types';

interface Props {
  session: GymSession | null;
  onStart: () => void;
  onEnd: () => void;
  onCancel: () => void;
  onMemoChange: (memo: string) => void;
  onSave: (calories: number) => void;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function GymSessionCard({
  session,
  onStart,
  onEnd,
  onCancel,
  onMemoChange,
  onSave,
}: Props) {
  // Elapsed seconds ticker (only for active state)
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calorie input for completed state
  const [calories, setCalories] = useState('');

  // Sync elapsed when session changes
  useEffect(() => {
    if (session?.status === 'active') {
      const base = Math.floor(
        (Date.now() - new Date(session.startedAt).getTime()) / 1000
      );
      setElapsed(base);
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (session?.status === 'completed') {
        setElapsed(session.durationSec ?? 0);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [session?.status, session?.startedAt]);

  // ── State 1: No session ──────────────────────────────────────────────
  if (!session) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🏋️</span>
          <div>
            <p className="text-sm font-bold text-gray-800">ジムセッション</p>
            <p className="text-xs text-gray-400">開始すると時間を計測します</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="w-full py-3 bg-[#FF7043] text-white text-sm font-semibold rounded-xl hover:bg-[#F4511E] transition-colors"
        >
          🏋️ ジムを開始する
        </button>
      </div>
    );
  }

  // ── State 2: Active ──────────────────────────────────────────────────
  if (session.status === 'active') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-[#FF7043]/30 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏋️</span>
            <p className="text-sm font-bold text-gray-800">ジムセッション</p>
          </div>
          <span className="px-2.5 py-0.5 bg-[#FF7043] text-white text-xs font-bold rounded-full animate-pulse">
            進行中
          </span>
        </div>

        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <p className="text-xs text-gray-400">開始時刻</p>
            <p className="text-sm font-semibold text-gray-700">{formatTime(session.startedAt)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">経過時間</p>
            <p className="text-2xl font-bold text-[#FF7043] tabular-nums">
              {formatElapsed(elapsed)}
            </p>
          </div>
        </div>

        <textarea
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#FF7043] bg-white resize-none mb-3 placeholder:text-gray-300"
          rows={2}
          placeholder="メモ（任意）"
          value={session.memo ?? ''}
          onChange={(e) => onMemoChange(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="flex-1 py-2.5 bg-[#FF7043] text-white text-sm font-semibold rounded-xl hover:bg-[#F4511E] transition-colors"
          >
            ジムを終了する
          </button>
        </div>
      </div>
    );
  }

  // ── State 3: Completed ───────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">🏋️</span>
        <div>
          <p className="text-sm font-bold text-gray-800">ジムセッション完了</p>
          <p className="text-xs text-gray-400">
            {formatTime(session.startedAt)} 〜 {session.endedAt ? formatTime(session.endedAt) : ''}
          </p>
        </div>
      </div>

      <div className="bg-[#FFF3E0] rounded-xl px-4 py-3 mb-3 text-center">
        <p className="text-xs text-[#FF7043] font-semibold mb-0.5">セッション時間</p>
        <p className="text-2xl font-bold text-[#FF7043] tabular-nums">
          {formatElapsed(session.durationSec ?? 0)}
        </p>
      </div>

      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-500 block mb-1.5">
          消費カロリー（kcal）
        </label>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF7043] bg-white"
          type="number"
          placeholder="例: 300"
          min={0}
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 border border-gray-200 text-gray-500 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
        >
          破棄する
        </button>
        <button
          type="button"
          onClick={() => {
            const kcal = parseInt(calories, 10);
            if (isNaN(kcal) || kcal < 0) {
              alert('消費カロリーを正しく入力してください');
              return;
            }
            onSave(kcal);
          }}
          className="flex-1 py-2.5 bg-[#FF7043] text-white text-sm font-semibold rounded-xl hover:bg-[#F4511E] transition-colors"
        >
          保存する
        </button>
      </div>
    </div>
  );
}
