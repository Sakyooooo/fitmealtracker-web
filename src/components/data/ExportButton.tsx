'use client';

import { useState } from 'react';
import { MealEntry, ExerciseEntry } from '@/lib/types';
import Modal from '@/components/ui/Modal';

type Props = {
  meals: MealEntry[];
  exercises: ExerciseEntry[];
};

type Period = '7' | '30' | 'all';

function toCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function downloadCsv(content: string, filename: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cutoffDate(period: Period): string | null {
  if (period === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (period === '7' ? 7 : 30));
  return d.toISOString().slice(0, 10);
}

export default function ExportButton({ meals, exercises }: Props) {
  const [showModal, setShowModal] = useState(false);

  function handleExport(period: Period) {
    setShowModal(false);
    const cutoff = cutoffDate(period);
    const filteredMeals = cutoff ? meals.filter((m) => m.date >= cutoff) : meals;
    const filteredExercises = cutoff ? exercises.filter((e) => e.date >= cutoff) : exercises;

    const today = new Date().toISOString().slice(0, 10);

    const mealRows: string[][] = [
      ['日付', '時刻', '食事名', 'カロリー', '区分', 'タンパク質(g)', '脂質(g)', '炭水化物(g)', 'メモ'],
      ...filteredMeals.map((m) => [
        m.date, m.time, m.name, String(m.calories), m.category,
        String(m.protein ?? ''), String(m.fat ?? ''), String(m.carbs ?? ''),
        m.note ?? '',
      ]),
    ];
    downloadCsv(toCsv(mealRows), `meal_records_${today}.csv`);

    const exRows: string[][] = [
      ['日付', '種目名', '時間(分)', '消費カロリー', 'メモ'],
      ...filteredExercises.map((e) => [
        e.date, e.name, String(e.durationMinutes), String(e.caloriesBurned), e.note,
      ]),
    ];
    downloadCsv(toCsv(exRows), `exercise_records_${today}.csv`);
  }

  const PERIOD_LABELS: { period: Period; label: string }[] = [
    { period: '7',   label: '直近7日' },
    { period: '30',  label: '直近30日' },
    { period: 'all', label: '全期間' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <h2 className="text-sm font-bold text-gray-700 mb-3">データ管理</h2>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="w-full py-3 bg-gray-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
      >
        <span>📤</span> データをエクスポート（CSV）
      </button>
      <p className="text-xs text-gray-400 mt-2 text-center">
        食事・運動記録を各CSVファイルでダウンロードします
      </p>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="エクスポート期間を選択">
        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          食事記録と運動記録をCSVで書き出します。<br />
          各ファイルが順番にダウンロードされます。
        </p>
        <div className="space-y-2">
          {PERIOD_LABELS.map(({ period, label }) => (
            <button
              key={period}
              type="button"
              onClick={() => handleExport(period)}
              className="w-full py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-gray-800 hover:bg-gray-50 transition-colors"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="w-full py-3 text-gray-400 text-sm mt-1"
          >
            キャンセル
          </button>
        </div>
      </Modal>
    </div>
  );
}
