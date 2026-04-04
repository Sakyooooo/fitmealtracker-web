'use client';

import { useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import WeightSummaryCard from '@/components/weight/WeightSummaryCard';
import WeightChart from '@/components/weight/WeightChart';
import WeightCard from '@/components/weight/WeightCard';
import AddWeightModal from '@/components/weight/AddWeightModal';
import Modal from '@/components/ui/Modal';

const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#42A5F5] bg-white';

export default function WeightPage() {
  const { weights, settings, addWeight, deleteWeight, updateSettings, hydrated } = useAppData();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Settings modal state
  const [targetStr, setTargetStr] = useState('');
  const [heightStr, setHeightStr] = useState('');

  function openSettings() {
    setTargetStr(settings.targetWeightKg ? String(settings.targetWeightKg) : '');
    setHeightStr(settings.heightCm ? String(settings.heightCm) : '');
    setShowSettingsModal(true);
  }

  function saveSettings() {
    const target = parseFloat(targetStr);
    const height = parseFloat(heightStr);
    if (targetStr && (isNaN(target) || target <= 0)) {
      alert('目標体重を正しく入力してください');
      return;
    }
    if (heightStr && (isNaN(height) || height < 50 || height > 250)) {
      alert('身長を正しく入力してください（50〜250 cm）');
      return;
    }
    updateSettings({
      targetWeightKg: targetStr ? target : undefined,
      heightCm: heightStr ? height : undefined,
    });
    setShowSettingsModal(false);
  }

  // Sort by date descending for list display
  const sorted = [...weights].sort((a, b) => b.date.localeCompare(a.date));

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        読み込み中...
      </div>
    );
  }

  return (
    <main className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">体重</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openSettings}
            className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            ⚙️ 設定
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#42A5F5] text-white text-sm font-semibold rounded-xl flex items-center gap-1 hover:bg-[#1E88E5] transition-colors"
          >
            ＋ 記録
          </button>
        </div>
      </div>

      {/* Summary */}
      <WeightSummaryCard weights={weights} settings={settings} />

      {/* Chart */}
      <WeightChart weights={weights} settings={settings} />

      {/* History list */}
      <h2 className="text-sm font-bold text-gray-700 mb-2">記録履歴</h2>
      <div className="space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-5xl mb-3">⚖️</p>
            <p className="text-sm font-medium">体重記録はありません</p>
            <p className="text-xs mt-1">「記録」ボタンから追加しましょう</p>
          </div>
        ) : (
          sorted.map((entry, i) => (
            <WeightCard
              key={entry.id}
              entry={entry}
              prevWeight={sorted[i + 1]?.weightKg}
              onDelete={deleteWeight}
            />
          ))
        )}
      </div>

      {/* Add modal */}
      <AddWeightModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={(data) => addWeight(data)}
      />

      {/* Settings modal */}
      <Modal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="体重の設定"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">
              目標体重（kg）
            </label>
            <input
              className={inputClass}
              type="number"
              step="0.1"
              min={1}
              placeholder="例: 60.0"
              value={targetStr}
              onChange={(e) => setTargetStr(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">
              身長（cm）— BMI計算に使用
            </label>
            <input
              className={inputClass}
              type="number"
              step="0.1"
              min={50}
              max={250}
              placeholder="例: 170"
              value={heightStr}
              onChange={(e) => setHeightStr(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={saveSettings}
              className="flex-1 py-3 bg-[#42A5F5] text-white text-sm font-semibold rounded-xl hover:bg-[#1E88E5] transition-colors"
            >
              保存する
            </button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
