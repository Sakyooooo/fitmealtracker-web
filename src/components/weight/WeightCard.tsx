'use client';

import { WeightEntry } from '@/lib/types';

type Props = {
  entry: WeightEntry;
  prevWeight?: number;
  onDelete: (id: string) => void;
};

export default function WeightCard({ entry, prevWeight, onDelete }: Props) {
  const diff =
    prevWeight !== undefined
      ? Math.round((entry.weightKg - prevWeight) * 10) / 10
      : null;

  return (
    <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
        ⚖️
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800">
          {entry.weightKg.toFixed(1)} kg
          {diff !== null && (
            <span
              className={`ml-2 text-xs font-medium ${
                diff < 0 ? 'text-[#4CAF50]' : diff > 0 ? 'text-[#EF5350]' : 'text-gray-400'
              }`}
            >
              {diff > 0 ? `+${diff}` : diff} kg
            </span>
          )}
        </p>
        {entry.note && (
          <p className="text-xs text-gray-400 truncate">{entry.note}</p>
        )}
        <p className="text-xs text-gray-300">{entry.date}</p>
      </div>
      <button
        type="button"
        onClick={() => onDelete(entry.id)}
        className="text-xs text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
      >
        削除
      </button>
    </div>
  );
}
