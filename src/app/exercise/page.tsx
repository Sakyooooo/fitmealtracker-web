'use client';

import { useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { getExercisesByDate, sumBurned, todayString } from '@/lib/stats';
import ExerciseSummaryCard from '@/components/exercise/ExerciseSummaryCard';
import ExerciseCard from '@/components/exercise/ExerciseCard';
import AddExerciseModal from '@/components/exercise/AddExerciseModal';
import GymSessionCard from '@/components/exercise/GymSessionCard';

export default function ExercisePage() {
  const {
    exercises, settings, gymSession, addExercise, deleteExercise, hydrated,
    startGym, endGym, cancelGym, updateGymMemo, saveGymAsExercise,
  } = useAppData();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'today' | 'all'>('today');

  const today = todayString();
  const todayExercises = getExercisesByDate(exercises, today);
  const todayBurned = sumBurned(todayExercises);

  const displayExercises = filter === 'today' ? todayExercises : exercises;
  const sorted = [...displayExercises].sort((a, b) => b.date.localeCompare(a.date));

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        読み込み中...
      </div>
    );
  }

  return (
    <main className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">運動</h1>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#FF7043] text-white text-sm font-semibold rounded-xl flex items-center gap-1 hover:bg-[#F4511E] transition-colors"
        >
          ＋ 追加
        </button>
      </div>

      <ExerciseSummaryCard burned={todayBurned} target={settings.targetBurnedCalories} />

      <GymSessionCard
        session={gymSession}
        onStart={startGym}
        onEnd={endGym}
        onCancel={cancelGym}
        onMemoChange={updateGymMemo}
        onSave={saveGymAsExercise}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['today', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[#FF7043] text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-[#FF7043]'
            }`}
          >
            {f === 'today' ? '本日' : '全件'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">🏃</p>
            <p className="text-sm font-medium">運動記録はありません</p>
            <p className="text-xs mt-1">「追加」ボタンから記録しましょう</p>
          </div>
        ) : (
          sorted.map((ex) => (
            <ExerciseCard key={ex.id} exercise={ex} onDelete={deleteExercise} />
          ))
        )}
      </div>

      <AddExerciseModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={(data) => addExercise(data)}
      />
    </main>
  );
}
