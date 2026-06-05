'use client';

import { useRef, useState } from 'react';
import { MealEntry, ExerciseEntry } from '@/lib/types';
import { bulkImportMeals, bulkImportExercises } from '@/lib/localRepository';
import Modal from '@/components/ui/Modal';

type Props = {
  meals: MealEntry[];
  exercises: ExerciseEntry[];
};

type Period = '7' | '30' | 'all';
type Format = 'csv' | 'json';

function toCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(content: string, filename: string) {
  downloadBlob(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' }), filename);
}

function downloadJson(data: unknown, filename: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

function cutoffDate(period: Period): string | null {
  if (period === 'all') return null;
  const d = new Date();
  d.setDate(d.getDate() - (period === '7' ? 7 : 30));
  return d.toISOString().slice(0, 10);
}

export default function ExportButton({ meals, exercises }: Props) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [format, setFormat] = useState<Format>('csv');
  const importRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  function handleExport(period: Period) {
    setShowExportModal(false);
    const cutoff = cutoffDate(period);
    const filteredMeals = cutoff ? meals.filter((m) => m.date >= cutoff) : meals;
    const filteredExercises = cutoff ? exercises.filter((e) => e.date >= cutoff) : exercises;
    const today = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      downloadJson(
        { meals: filteredMeals, exercises: filteredExercises, exportedAt: today },
        `fitmealtracker_${today}.json`,
      );
      return;
    }

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

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const text = await file.text();
      let data: { meals?: MealEntry[]; exercises?: ExerciseEntry[] };
      try {
        data = JSON.parse(text);
      } catch {
        alert('JSONファイルの読み込みに失敗しました。形式を確認してください。');
        return;
      }
      if (!data || typeof data !== 'object') {
        alert('不正なデータ形式です。');
        return;
      }
      const mealCount = Array.isArray(data.meals) ? data.meals.length : 0;
      const exerciseCount = Array.isArray(data.exercises) ? data.exercises.length : 0;
      if (mealCount === 0 && exerciseCount === 0) {
        alert('インポートできるデータが見つかりませんでした。');
        return;
      }
      if (!confirm(`食事 ${mealCount}件・運動 ${exerciseCount}件をインポートします（重複は自動スキップ）。よろしいですか？`)) return;
      if (Array.isArray(data.meals)) await bulkImportMeals(data.meals);
      if (Array.isArray(data.exercises)) await bulkImportExercises(data.exercises);
      alert('インポートが完了しました。ページを再読み込みします。');
      window.location.reload();
    } finally {
      setImporting(false);
    }
  }

  const PERIOD_LABELS: { period: Period; label: string }[] = [
    { period: '7',   label: '直近7日' },
    { period: '30',  label: '直近30日' },
    { period: 'all', label: '全期間' },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <h2 className="text-sm font-bold text-gray-700 mb-3">データ管理</h2>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className="flex-1 py-3 bg-gray-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
        >
          <span>📤</span> エクスポート
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          disabled={importing}
          className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <span>📥</span> {importing ? 'インポート中...' : 'インポート'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">
        エクスポート: CSV または JSON形式 / インポート: JSONのみ
      </p>

      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />

      <Modal open={showExportModal} onClose={() => setShowExportModal(false)} title="エクスポート設定">
        {/* Format selector */}
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-2">形式</p>
          <div className="flex gap-2">
            {(['csv', 'json'] as Format[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  format === f
                    ? 'border-gray-800 bg-gray-800 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          {format === 'json' && (
            <p className="text-xs text-gray-400 mt-1.5">1ファイルにまとめてダウンロード。後でインポートも可能。</p>
          )}
        </div>

        {/* Period selector */}
        <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-2">期間</p>
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
            onClick={() => setShowExportModal(false)}
            className="w-full py-3 text-gray-400 text-sm mt-1"
          >
            キャンセル
          </button>
        </div>
      </Modal>
    </div>
  );
}
