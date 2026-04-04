'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { todayString } from '@/lib/stats';
import { WeightEntry } from '@/lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<WeightEntry, 'id'>) => void;
};

const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#42A5F5] bg-white';

export default function AddWeightModal({ open, onClose, onSave }: Props) {
  const [weightStr, setWeightStr] = useState('');
  const [date, setDate] = useState(todayString());
  const [note, setNote] = useState('');

  function handleSave() {
    const kg = parseFloat(weightStr);
    if (isNaN(kg) || kg <= 0 || kg > 500) {
      alert('体重を正しく入力してください（例: 65.5）');
      return;
    }
    onSave({ weightKg: kg, date, note });
    setWeightStr('');
    setNote('');
    setDate(todayString());
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="体重を記録">
      <div className="space-y-4">
        {/* Date */}
        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-1.5">日付</label>
          <input
            className={inputClass}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Weight */}
        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-1.5">
            体重（kg）
          </label>
          <input
            className={inputClass}
            type="number"
            step="0.1"
            min={1}
            max={500}
            placeholder="例: 65.5"
            value={weightStr}
            onChange={(e) => setWeightStr(e.target.value)}
            autoFocus
          />
        </div>

        {/* Note */}
        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-1.5">
            メモ（任意）
          </label>
          <input
            className={inputClass}
            type="text"
            placeholder="朝食前、起床後 など"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 bg-[#42A5F5] text-white text-sm font-semibold rounded-xl hover:bg-[#1E88E5] transition-colors"
          >
            保存する
          </button>
        </div>
      </div>
    </Modal>
  );
}
