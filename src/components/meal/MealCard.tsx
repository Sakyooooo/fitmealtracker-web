'use client';

import { MealEntry } from '@/lib/types';

type Props = {
  meal: MealEntry;
  onDelete: (id: string) => void;
};

const CATEGORY_COLORS: Record<string, string> = {
  朝食: 'text-orange-500',
  昼食: 'text-blue-500',
  夕食: 'text-amber-600',
  間食: 'text-purple-500',
};

export default function MealCard({ meal, onDelete }: Props) {
  const catColor = CATEGORY_COLORS[meal.category] ?? 'text-gray-500';

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm border-l-[3px] border-[#4CAF50]">
      {/* ローカル写真(photoUri)優先。シェアで取り込んだ記録は元投稿の公開URL(photoUrl)を表示 */}
      {(meal.photoUri || meal.photoUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meal.photoUri ?? meal.photoUrl ?? undefined}
          alt={meal.name}
          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          style={{ objectPosition: `${meal.photoFocusX ?? 50}% ${meal.photoFocusY ?? 50}%` }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-gray-900 tracking-tight truncate">{meal.name}</p>
        <p className="text-xs text-gray-400 mt-0.5 font-medium">
          <span className={`${catColor} font-bold`}>{meal.category}</span>
          <span className="mx-1">·</span>
          {meal.time}
          {meal.date && <span className="ml-2 text-gray-300">{meal.date}</span>}
        </p>
        {(meal.protein != null || meal.fat != null || meal.carbs != null) && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            P:{meal.protein ?? '—'}g · F:{meal.fat ?? '—'}g · C:{meal.carbs ?? '—'}g
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-base font-black text-[#4CAF50] leading-none">{meal.calories.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 font-medium tracking-wide">KCAL</p>
        </div>
        <button
          onClick={() => {
            if (window.confirm(`「${meal.name}」を削除しますか？`)) onDelete(meal.id);
          }}
          className="text-gray-200 hover:text-red-400 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
