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
};

export default function DayDetailModal({ open, onClose, date, meals, exercises }: Props) {
  const [year, month, day] = date.split('-').map(Number);
  const dayMeals = getMealsByDate(meals, date);
  const dayExercises = getExercisesByDate(exercises, date);

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
        {dayMeals.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl">記録なし</p>
        ) : (
          <div className="space-y-2">
            {dayMeals.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <span className="text-xs text-gray-400 mr-2">{m.time} {m.category}</span>
                  <span className="font-medium text-gray-700">{m.name}</span>
                </div>
                <span className="font-bold text-[#4CAF50] ml-2 flex-shrink-0">{m.calories} kcal</span>
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
              <div key={e.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-3 py-2">
                <div>
                  <span className="font-medium text-gray-700">{e.name}</span>
                  <span className="text-xs text-gray-400 ml-2">{e.durationMinutes}分</span>
                </div>
                <span className="font-bold text-[#FF7043] ml-2 flex-shrink-0">{e.caloriesBurned} kcal</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </Modal>
  );
}
