'use client';

import { useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import {
  getRecentDayStats, getMealsByDate, todayString,
  sumProtein, sumFat, sumCarbs, calcStreak,
} from '@/lib/stats';
import WeeklyChart from '@/components/data/WeeklyChart';
import WeeklySummary from '@/components/data/WeeklySummary';
import PfcProgress from '@/components/data/PfcProgress';
import ExportButton from '@/components/data/ExportButton';
import Modal from '@/components/ui/Modal';

const DEFAULT_TARGET_PROTEIN = 60;
const DEFAULT_TARGET_FAT = 60;
const DEFAULT_TARGET_CARBS = 260;

export default function DataPage() {
  const { meals, exercises, settings, updateSettings, hydrated } = useAppData();

  const weekStats = getRecentDayStats(meals, exercises, 7);
  const streak = calcStreak(meals, exercises);

  const today = todayString();
  const todayMeals = getMealsByDate(meals, today);
  const todayProtein = sumProtein(todayMeals);
  const todayFat = sumFat(todayMeals);
  const todayCarbs = sumCarbs(todayMeals);
  const hasTodayPfc = todayProtein > 0 || todayFat > 0 || todayCarbs > 0;

  const targetProtein = settings.targetProtein ?? DEFAULT_TARGET_PROTEIN;
  const targetFat = settings.targetFat ?? DEFAULT_TARGET_FAT;
  const targetCarbs = settings.targetCarbs ?? DEFAULT_TARGET_CARBS;

  const [showPfcModal, setShowPfcModal] = useState(false);
  const [pfcP, setPfcP] = useState(String(targetProtein));
  const [pfcF, setPfcF] = useState(String(targetFat));
  const [pfcC, setPfcC] = useState(String(targetCarbs));

  function openPfcModal() {
    setPfcP(String(targetProtein));
    setPfcF(String(targetFat));
    setPfcC(String(targetCarbs));
    setShowPfcModal(true);
  }

  function savePfc() {
    const p = parseInt(pfcP, 10);
    const f = parseInt(pfcF, 10);
    const c = parseInt(pfcC, 10);
    if ([p, f, c].some((v) => isNaN(v) || v <= 0)) {
      alert('各栄養素の目標値を正しく入力してください');
      return;
    }
    updateSettings({ targetProtein: p, targetFat: f, targetCarbs: c });
    setShowPfcModal(false);
  }

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        読み込み中...
      </div>
    );
  }

  const inputClass =
    'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4CAF50] bg-white';

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold text-gray-800 mb-4">データ</h1>

      <WeeklyChart data={weekStats} />
      <WeeklySummary stats={weekStats} streak={streak} />
      <PfcProgress
        todayProtein={todayProtein}
        todayFat={todayFat}
        todayCarbs={todayCarbs}
        targetProtein={targetProtein}
        targetFat={targetFat}
        targetCarbs={targetCarbs}
        hasTodayPfc={hasTodayPfc}
        onEdit={openPfcModal}
      />
      <ExportButton meals={meals} exercises={exercises} />

      {/* PFC Goal Modal */}
      <Modal
        open={showPfcModal}
        onClose={() => setShowPfcModal(false)}
        title="1日のPFC目標を設定"
      >
        <div className="space-y-4">
          {[
            { label: '🟦 タンパク質（g）', val: pfcP, set: setPfcP },
            { label: '🟨 脂質（g）',       val: pfcF, set: setPfcF },
            { label: '🟩 炭水化物（g）',   val: pfcC, set: setPfcC },
          ].map(({ label, val, set }) => (
            <div key={label}>
              <label className="text-sm font-semibold text-gray-600 block mb-1.5">{label}</label>
              <input
                className={inputClass}
                type="number"
                value={val}
                onChange={(e) => set(e.target.value)}
                min={1}
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowPfcModal(false)}
              className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={savePfc}
              className="flex-1 py-3 bg-[#4CAF50] text-white text-sm font-semibold rounded-xl hover:bg-[#43A047] transition-colors"
            >
              保存する
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
