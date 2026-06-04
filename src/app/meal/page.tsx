'use client';

import { useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import { getMealsByDate, sumCalories, todayString } from '@/lib/stats';
import MealCard from '@/components/meal/MealCard';
import AddMealModal from '@/components/meal/AddMealModal';
import Modal from '@/components/ui/Modal';

// Faint restaurant/cafe background
const MEAL_BG =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=40';

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const over = clamped >= 100;
  return (
    <div className="w-44 h-1.5 bg-gray-200 rounded-full mt-4 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-400' : 'bg-[#4CAF50]'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export default function MealPage() {
  const { meals, settings, addMeal, deleteMeal, updateSettings, hydrated } = useAppData();
  const [showModal, setShowModal] = useState(false);
  const [showList, setShowList] = useState(false);

  // ── Goal setting ─────────────────────────────────────────────────────────────
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalValueStr, setGoalValueStr] = useState('');

  function openGoalModal() {
    setGoalValueStr(settings.targetIntakeCalories ? String(settings.targetIntakeCalories) : '');
    setShowGoalModal(true);
  }
  function saveGoal() {
    const val = parseInt(goalValueStr, 10);
    if (isNaN(val) || val <= 0) { alert('目標カロリーを正しく入力してください'); return; }
    updateSettings({ targetIntakeCalories: val });
    setShowGoalModal(false);
  }
  function clearGoal() {
    updateSettings({ targetIntakeCalories: undefined });
    setShowGoalModal(false);
  }

  const today = todayString();
  const todayMeals = getMealsByDate(meals, today);
  const todayIntake = sumCalories(todayMeals);
  const target = settings.targetIntakeCalories;
  const progressPct = target ? (todayIntake / target) * 100 : 0;
  const goalLabel = target ? `${target.toLocaleString()} kcal` : null;

  const minHeight = 'calc(100svh - 130px)';

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-300 text-sm font-bold tracking-widest">LOADING</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white">
      {/* Page-wide faint background */}
      <div
        className="fixed inset-0 bg-cover bg-center pointer-events-none select-none z-0"
        style={{ backgroundImage: `url(${MEAL_BG})`, opacity: 0.07 }}
      />

      <div className="relative z-10">
        {/* ── Hero area ── */}
        <div className="flex flex-col" style={{ minHeight }}>
          {/* Header */}
          <div className="px-4 pt-4 pb-2">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">食事</h1>
            <div className="flex gap-3 mt-1 items-center">
              <span className="text-sm font-bold text-gray-900">クイック記録</span>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={openGoalModal}
                className="text-sm font-bold text-gray-900 flex items-center gap-1.5"
              >
                {goalLabel ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#4CAF50] inline-block" />
                    <span>{goalLabel}</span>
                  </>
                ) : (
                  <span className="text-gray-400">目標設定</span>
                )}
              </button>
            </div>
          </div>

          {/* Big metric */}
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="flex items-baseline gap-2">
              <p
                className="font-black italic leading-none tracking-tighter text-gray-900 tabular-nums"
                style={{ fontSize: 'clamp(76px, 23vw, 120px)' }}
              >
                {todayIntake.toLocaleString()}
              </p>
              {target && (
                <p
                  className="font-black italic text-gray-300 tabular-nums leading-none"
                  style={{ fontSize: 'clamp(32px, 10vw, 52px)' }}
                >
                  / {target.toLocaleString()}
                </p>
              )}
            </div>
            <div className="w-44 h-[2px] bg-gray-900 mt-3 mb-3" />
            <p className="text-sm font-bold tracking-[0.2em] text-gray-500">KCAL TODAY</p>
            {target && <ProgressBar pct={progressPct} />}
            {target && progressPct >= 100 && (
              <p className="text-xs font-black text-red-400 mt-2 tracking-widest">OVER GOAL ⚠️</p>
            )}
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center pb-6 gap-4">
            <div className="flex items-center gap-8">
              {/* Left — camera / photo shortcut */}
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200
                           flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>

              {/* Main record button */}
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="w-28 h-28 rounded-full bg-[#4CAF50] flex items-center justify-center
                           shadow-xl active:scale-95 transition-transform"
              >
                <span className="text-white font-black text-base tracking-widest">RECORD</span>
              </button>

              {/* Right — placeholder */}
              <div className="w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200
                              flex items-center justify-center shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent meals toggle ── */}
        <div className="px-4 pb-2">
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            className="flex items-center gap-2 text-xs font-black text-gray-400 tracking-widest uppercase"
          >
            <span>{showList ? '▲' : '▼'}</span>
            <span>Recent Meals</span>
            {meals.length > 0 && (
              <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-[10px] font-bold">
                {meals.length}
              </span>
            )}
          </button>
        </div>

        {showList && (
          <div className="px-4 pb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                All Meals
              </p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="px-3 py-1.5 bg-gray-900 text-white text-xs font-black rounded-lg tracking-wide"
                >
                  + 追加
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {meals.length === 0 ? (
                <p className="text-center py-8 text-xs font-bold text-gray-300 tracking-widest">
                  NO MEALS YET
                </p>
              ) : (
                [...meals]
                  .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                  .map((meal) => (
                    <MealCard key={meal.id} meal={meal} onDelete={deleteMeal} />
                  ))
              )}
            </div>
          </div>
        )}

        {/* ── Goal setting modal ── */}
        <Modal open={showGoalModal} onClose={() => setShowGoalModal(false)} title="摂取カロリー目標を設定">
          <div className="mb-6">
            <label className="text-xs font-black text-gray-400 tracking-widest uppercase block mb-2">
              目標カロリー（KCAL）
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                className="flex-1 text-center text-4xl font-black text-gray-900 bg-gray-50
                           border-0 rounded-2xl px-4 py-4 focus:outline-none focus:bg-gray-100 tabular-nums"
                placeholder="2000"
                value={goalValueStr}
                onChange={(e) => setGoalValueStr(e.target.value)}
                autoFocus
              />
              <span className="text-lg font-black text-gray-400 w-12">kcal</span>
            </div>
            {/* Quick picks */}
            <div className="flex gap-2 mt-3">
              {[1400, 1600, 1800, 2000, 2200].map((v) => (
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
          <div className="flex gap-2">
            {target && (
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

        <AddMealModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onSave={(data) => addMeal(data)}
        />
      </div>
    </div>
  );
}
