'use client';

import { ExerciseEntry } from '@/lib/types';

type Props = {
  exercise: ExerciseEntry;
  onDelete: (id: string) => void;
};

export default function ExerciseCard({ exercise, onDelete }: Props) {
  return (
    <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-xl flex-shrink-0">
        🏃
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{exercise.name}</p>
        <p className="text-xs text-gray-400">
          {exercise.durationMinutes}分
          {exercise.note ? ` · ${exercise.note}` : ''}
        </p>
        <p className="text-xs text-gray-300">{exercise.date}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-lg font-bold text-[#FF7043]">{exercise.caloriesBurned}</span>
        <span className="text-xs text-gray-400">kcal</span>
        <button
          onClick={() => onDelete(exercise.id)}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  );
}
