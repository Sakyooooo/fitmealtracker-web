'use client';

import Modal from '@/components/ui/Modal';
import { MealEntry, ExerciseEntry } from '@/lib/types';
import { getMealsByDate, getExercisesByDate, sumCalories, sumBurned } from '@/lib/stats';

type Props = {
  open: boolean;
  onClose: () => void;
  date: string;
  meals: MealEntry[];
  exercises: ExerciseEntry[];
  onDeleteMeal?: (id: string) => void;
  onDeleteExercise?: (id: string) => void;
};

const CATEGORY_ORDER = ['朝食', '昼食', '夕食', '間食'];

export default function DayDetailModal({
  open, onClose, date, meals, exercises, onDeleteMeal, onDeleteExercise,
}: Props) {
  const [, month, day] = date.split('-').map(Number);
  const dayMeals = getMealsByDate(meals, date);
  const dayExercises = getExercisesByDate(exercises, date);

  // 食事は時刻順（時刻が無ければ区分順）で並べて遡りやすくする
  const sortedMeals = [...dayMeals].sort((a, b) => {
    if (a.time && b.time && a.time !== b.time) return a.time.localeCompare(b.time);
    return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  });

  return (
    <Modal open={open} onClose={onClose} title={`${month}月${day}日の記録`}>
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">摂取カロリー</p>
          <p className="text-2xl font-bold text-[#4CAF50]">{sumCalories(dayMeals).toLocaleString()}</p>
          <p className="text-xs text-gray-400">kcal</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">消費カロリー</p>
          <p className="text-2xl font-bold text-[#FF7043]">{sumBurned(dayExercises).toLocaleString()}</p>
          <p className="text-xs text-gray-400">kcal</p>
        </div>
      </div>

      {/* Meals */}
      <section className="mb-4">
        <h3 className="text-sm font-bold text-gray-700 mb-2">
          食事記録
          <span className="ml-2 text-xs font-normal text-gray-400">{dayMeals.length}件</span>
        </h3>
        {sortedMeals.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl">記録なし</p>
        ) : (
          <div className="space-y-2">
            {sortedMeals.map((m) => (
              <div key={m.id} className="flex gap-2.5 bg-gray-50 rounded-xl p-2.5">
                {m.photoUri && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photoUri} alt={m.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    style={{ objectPosition: `${m.photoFocusX ?? 50}% ${m.photoFocusY ?? 50}%` }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-400 font-medium">
                    {m.time && <span className="mr-1.5">{m.time}</span>}
                    <span className="text-gray-500 font-bold">{m.category}</span>
                  </p>
                  <p className="text-sm font-bold text-gray-700 truncate">{m.name}</p>
                  {(m.protein != null || m.fat != null || m.carbs != null) && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      P:{m.protein ?? '—'}g · F:{m.fat ?? '—'}g · C:{m.carbs ?? '—'}g
                    </p>
                  )}
                  {m.note && <p className="text-[10px] text-gray-400 truncate">{m.note}</p>}
                </div>
                <div className="flex flex-col items-end justify-between flex-shrink-0">
                  <span className="text-sm font-black text-[#4CAF50] whitespace-nowrap">
                    {m.calories}<span className="text-[10px] font-bold text-gray-400 ml-0.5">kcal</span>
                  </span>
                  {onDeleteMeal && (
                    <button
                      type="button"
                      onClick={() => { if (window.confirm(`「${m.name}」を削除しますか？`)) onDeleteMeal(m.id); }}
                      className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                      aria-label="削除"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Exercises */}
      <section>
        <h3 className="text-sm font-bold text-gray-700 mb-2">
          運動記録
          <span className="ml-2 text-xs font-normal text-gray-400">{dayExercises.length}件</span>
        </h3>
        {dayExercises.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl">記録なし</p>
        ) : (
          <div className="space-y-2">
            {dayExercises.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-700 truncate">
                    {e.name}
                    <span className="text-xs font-normal text-gray-400 ml-2">{e.durationMinutes}分</span>
                  </p>
                  {e.note && <p className="text-[10px] text-gray-400 truncate whitespace-pre-line">{e.note}</p>}
                </div>
                <span className="font-black text-[#FF7043] flex-shrink-0 whitespace-nowrap">
                  {e.caloriesBurned}<span className="text-[10px] font-bold text-gray-400 ml-0.5">kcal</span>
                </span>
                {onDeleteExercise && (
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(`「${e.name}」を削除しますか？`)) onDeleteExercise(e.id); }}
                    className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
                    aria-label="削除"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </Modal>
  );
}
