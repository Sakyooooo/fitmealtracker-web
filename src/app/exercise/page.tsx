'use client';

import { useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { getExercisesByDate, sumBurned, todayString } from '@/lib/stats';
import { GymGoalType } from '@/lib/types';
import ExerciseCard from '@/components/exercise/ExerciseCard';
import AddExerciseModal from '@/components/exercise/AddExerciseModal';
import GymSessionCard, { GymGoal } from '@/components/exercise/GymSessionCard';
import Modal from '@/components/ui/Modal';

export default function ExercisePage() {
  const {
    exercises, settings, gymSession, addExercise, deleteExercise, hydrated,
    startGym, endGym, cancelGym, updateGymMemo, saveGymAsExercise, updateSettings,
  } = useAppData();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showList, setShowList] = useState(false);

  // ── Goal setting modal ───────────────────────────────────────────────────────
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalType, setGoalType] = useState<GymGoalType>(
    settings.gymGoalType ?? 'calories',
  );
  const [goalValueStr, setGoalValueStr] = useState(
    settings.gymGoalValue ? String(settings.gymGoalValue) : '',
  );

  function openGoalModal() {
    setGoalType(settings.gymGoalType ?? 'calories');
    setGoalValueStr(settings.gymGoalValue ? String(settings.gymGoalValue) : '');
    setShowGoalModal(true);
  }

  function saveGoal() {
    const val = parseInt(goalValueStr, 10);
    if (isNaN(val) || val <= 0) {
      alert('目標値を正しく入力してください');
      return;
    }
    updateSettings({ gymGoalType: goalType, gymGoalValue: val });
    setShowGoalModal(false);
  }

  function clearGoal() {
    updateSettings({ gymGoalType: undefined, gymGoalValue: undefined });
    setShowGoalModal(false);
  }

  // ── Computed values ──────────────────────────────────────────────────────────
  const today = todayString();
  const todayExercises = getExercisesByDate(exercises, today);
  const todayBurned = sumBurned(todayExercises);
  const todayMinutes = todayExercises.reduce((s, e) => s + e.durationMinutes, 0);

  const gymGoal: GymGoal | undefined =
    settings.gymGoalType && settings.gymGoalValue
      ? { type: settings.gymGoalType, value: settings.gymGoalValue }
      : undefined;

  const isActive = gymSession?.status === 'active';

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-300 text-sm font-bold tracking-widest">LOADING</p>
      </div>
    );
  }

  const GYM_BG =
    'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=900&q=40';

  return (
    // ClientLayout の外側ラッパーが固定ナビぶんの padding を既に確保しているため、
    // min-h-screen を足すと二重に高さを主張し、bodyがスクロール可能になって
    // 固定ナビがスクロール中にずれる原因になっていた（friends/page.tsxと同じ理由）。
    <div className="relative bg-white min-h-[calc(100svh_-_3.5rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] md:min-h-screen">
      {/* Page-wide faint gym background */}
      <div
        className="fixed inset-0 bg-cover bg-center pointer-events-none select-none z-0"
        style={{ backgroundImage: `url(${GYM_BG})`, opacity: 0.06 }}
      />
      <div className="relative z-10">
      {/* ── Main gym card ── */}
      <GymSessionCard
        session={gymSession}
        todayBurned={todayBurned}
        todayMinutes={todayMinutes}
        gymGoal={gymGoal}
        onStart={startGym}
        onEnd={endGym}
        onCancel={cancelGym}
        onMemoChange={updateGymMemo}
        onSave={saveGymAsExercise}
        onAddManual={() => setShowAddModal(true)}
        onGoalSetting={openGoalModal}
      />

      {/* ── Activity list toggle ── */}
      <div className="px-4 pb-2">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="flex items-center gap-2 text-xs font-black text-gray-400 tracking-widest uppercase"
        >
          <span>{showList ? '▲' : '▼'}</span>
          <span>Recent Activity</span>
          {exercises.length > 0 && (
            <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-[10px] font-bold">
              {exercises.length}
            </span>
          )}
        </button>
      </div>

      {showList && (
        <div className="px-4 pb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">All Activity</p>
            {!isActive && (
              <button
                type="button" onClick={() => setShowAddModal(true)}
                className="px-3 py-1.5 bg-gray-900 text-white text-xs font-black rounded-lg tracking-wide"
              >
                + 追加
              </button>
            )}
          </div>
          <div className="space-y-2">
            {exercises.length === 0 ? (
              <p className="text-center py-8 text-xs font-bold text-gray-300 tracking-widest">NO ACTIVITY YET</p>
            ) : (
              [...exercises]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((ex) => (
                  <ExerciseCard key={ex.id} exercise={ex} onDelete={deleteExercise} />
                ))
            )}
          </div>
        </div>
      )}

      {/* ── Goal setting modal ── */}
      <Modal open={showGoalModal} onClose={() => setShowGoalModal(false)} title="目標を設定">
        {/* Goal type toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
          {([
            { id: 'calories' as GymGoalType, label: 'カロリー', unit: 'kcal' },
            { id: 'time'     as GymGoalType, label: '時間',     unit: '分'   },
          ]).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setGoalType(opt.id)}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                goalType === opt.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Value input */}
        <div className="mb-6">
          <label className="text-xs font-black text-gray-400 tracking-widest uppercase block mb-2">
            {goalType === 'calories' ? '目標カロリー（kcal）' : '目標時間（分）'}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              className="flex-1 text-center text-4xl font-black text-gray-900 bg-gray-50
                         border-0 rounded-2xl px-4 py-4 focus:outline-none focus:bg-gray-100
                         tabular-nums"
              placeholder={goalType === 'calories' ? '300' : '60'}
              value={goalValueStr}
              onChange={(e) => setGoalValueStr(e.target.value)}
              autoFocus
            />
            <span className="text-lg font-black text-gray-400 w-12">
              {goalType === 'calories' ? 'kcal' : '分'}
            </span>
          </div>

          {/* Quick picks */}
          <div className="flex gap-2 mt-3">
            {(goalType === 'calories'
              ? [200, 300, 400, 500, 700]
              : [30, 45, 60, 90, 120]
            ).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setGoalValueStr(String(v))}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                  goalValueStr === String(v)
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          {gymGoal && (
            <button
              type="button" onClick={clearGoal}
              className="px-4 py-3 border border-gray-200 text-gray-400 text-sm font-bold rounded-xl hover:bg-gray-50"
            >
              解除
            </button>
          )}
          <button
            type="button" onClick={() => setShowGoalModal(false)}
            className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="button" onClick={saveGoal}
            className="flex-1 py-3 bg-gray-900 text-white text-sm font-black rounded-xl hover:bg-gray-800"
          >
            設定する
          </button>
        </div>
      </Modal>

      <AddExerciseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={(data) => addExercise(data)}
      />
      </div>
    </div>
  );
}
