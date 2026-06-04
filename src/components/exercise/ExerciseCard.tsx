'use client';

import { ExerciseEntry } from '@/lib/types';

type Props = {
  exercise: ExerciseEntry;
  onDelete: (id: string) => void;
};

export default function ExerciseCard({ exercise, onDelete }: Props) {
  return (
    <div className="flex items-center gap-4 bg-white rounded-xl px-4 py-3.5 shadow-sm border-l-[3px] border-[#FF7043]">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-gray-900 tracking-tight">{exercise.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 font-medium">
          {exercise.durationMinutes} min
          {exercise.note ? ` · ${exercise.note}` : ''}
          <span className="ml-2 text-gray-300">{exercise.date}</span>
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-base font-black text-[#FF7043] leading-none">{exercise.caloriesBurned}</p>
          <p className="text-[10px] text-gray-400 font-medium tracking-wide">KCAL</p>
        </div>
        <button
          onClick={() => onDelete(exercise.id)}
          className="text-gray-200 hover:text-red-400 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
