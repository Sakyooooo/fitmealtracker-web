'use client';

import { MealEntry } from '@/lib/types';

type Props = {
  meal: MealEntry;
  onDelete: (id: string) => void;
};

const CATEGORY_COLORS: Record<string, string> = {
  朝食: 'bg-orange-100 text-orange-700',
  昼食: 'bg-blue-100 text-blue-700',
  夕食: 'bg-amber-100 text-amber-800',
  間食: 'bg-purple-100 text-purple-700',
};

export default function MealCard({ meal, onDelete }: Props) {
  const badgeClass = CATEGORY_COLORS[meal.category] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
      {meal.photoUri && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meal.photoUri}
          alt={meal.name}
          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
            {meal.category}
          </span>
          <span className="text-xs text-gray-400">{meal.time}</span>
          {meal.date && <span className="text-xs text-gray-300">{meal.date}</span>}
        </div>
        <p className="text-sm font-semibold text-gray-800 truncate">{meal.name}</p>
        {(meal.protein != null || meal.fat != null || meal.carbs != null) && (
          <p className="text-xs text-gray-400 mt-0.5">
            P:{meal.protein ?? '—'}g　F:{meal.fat ?? '—'}g　C:{meal.carbs ?? '—'}g
          </p>
        )}
        {meal.note && <p className="text-xs text-gray-400 truncate">{meal.note}</p>}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-lg font-bold text-[#4CAF50]">{meal.calories}</span>
        <span className="text-xs text-gray-400">kcal</span>
        <button
          onClick={() => onDelete(meal.id)}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  );
}
