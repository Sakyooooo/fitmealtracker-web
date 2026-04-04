'use client';

import { useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { getMealsByDate, sumCalories, todayString } from '@/lib/stats';
import MealSummaryCard from '@/components/meal/MealSummaryCard';
import MealCard from '@/components/meal/MealCard';
import AddMealModal from '@/components/meal/AddMealModal';

export default function MealPage() {
  const { meals, settings, addMeal, deleteMeal, hydrated } = useAppData();
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'today' | 'all'>('today');

  const today = todayString();
  const todayMeals = getMealsByDate(meals, today);
  const todayIntake = sumCalories(todayMeals);

  const displayMeals = filter === 'today' ? todayMeals : meals;
  const sorted = [...displayMeals].sort(
    (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
  );

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
        <h1 className="text-xl font-bold text-gray-800">食事</h1>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#4CAF50] text-white text-sm font-semibold rounded-xl flex items-center gap-1 hover:bg-[#43A047] transition-colors"
        >
          ＋ 追加
        </button>
      </div>

      <MealSummaryCard intake={todayIntake} target={settings.targetIntakeCalories} />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['today', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-[#4CAF50] text-white'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-[#4CAF50]'
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
            <p className="text-5xl mb-3">🍽️</p>
            <p className="text-sm font-medium">食事記録はありません</p>
            <p className="text-xs mt-1">「追加」ボタンから記録しましょう</p>
          </div>
        ) : (
          sorted.map((meal) => (
            <MealCard key={meal.id} meal={meal} onDelete={deleteMeal} />
          ))
        )}
      </div>

      <AddMealModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={(data) => addMeal(data)}
      />
    </main>
  );
}
