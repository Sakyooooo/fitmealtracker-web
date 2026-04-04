'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { ExerciseEntry } from '@/lib/types';
import { todayString } from '@/lib/stats';
import { DEFAULT_PRESETS, estimateExerciseCalories } from '@/lib/activities';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<ExerciseEntry, 'id'>) => void;
};

const FAV_KEY = 'fmt_fav_exercises';

function loadFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAV_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

function saveFavorites(favs: string[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  }
}

export default function AddExerciseModal({ open, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [burned, setBurned] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (open) setFavorites(loadFavorites());
  }, [open]);

  // Auto-estimate calories
  useEffect(() => {
    const dur = parseInt(duration, 10);
    if (name.trim() && !isNaN(dur) && dur > 0) {
      setBurned(String(estimateExerciseCalories(name.trim(), dur)));
    }
  }, [name, duration]);

  const orderedPresets = [
    ...favorites.filter((f) => DEFAULT_PRESETS.includes(f)),
    ...DEFAULT_PRESETS.filter((p) => !favorites.includes(p)),
  ];

  function toggleFavorite(preset: string) {
    const next = favorites.includes(preset)
      ? favorites.filter((f) => f !== preset)
      : [...favorites, preset];
    setFavorites(next);
    saveFavorites(next);
  }

  function selectPreset(preset: string) {
    setName(preset === 'その他' ? '' : preset);
  }

  function reset() {
    setName(''); setDuration(''); setBurned(''); setNote('');
  }

  function handleClose() { reset(); onClose(); }

  function handleSave() {
    if (!name.trim()) { alert('種目名を入力してください'); return; }
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur <= 0) { alert('時間（分）を正しく入力してください'); return; }
    const cal = parseInt(burned, 10);
    if (isNaN(cal) || cal < 0) { alert('消費カロリーを正しく入力してください'); return; }
    onSave({
      name: name.trim(),
      durationMinutes: dur,
      caloriesBurned: cal,
      date: todayString(),
      note: note.trim(),
      type: 'normal',
    });
    reset();
    onClose();
  }

  const inputClass = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF7043] bg-white';

  return (
    <Modal open={open} onClose={handleClose} title="運動を追加">
      {/* Presets */}
      <div className="mb-4">
        <label className="text-sm font-semibold text-gray-600 block mb-2">種目プリセット</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {orderedPresets.map((preset) => {
            const isFav = favorites.includes(preset);
            const isSelected = name === preset || (preset === 'その他' && name === '');
            return (
              <div key={preset} className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => selectPreset(preset)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                    isSelected
                      ? 'bg-[#FF7043] border-[#FF7043] text-white'
                      : 'border-gray-200 text-gray-600 hover:border-[#FF7043] hover:text-[#FF7043]'
                  }`}
                >
                  {preset}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(preset)}
                  className={`text-base leading-none transition-colors ${isFav ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
                  title={isFav ? 'お気に入り解除' : 'お気に入り登録'}
                >
                  ★
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <label className="text-sm font-semibold text-gray-600 block mb-1.5">種目名</label>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="種目名を入力（または上から選択）"
          maxLength={40}
        />
      </div>

      <div className="mb-4">
        <label className="text-sm font-semibold text-gray-600 block mb-1.5">時間（分）</label>
        <input
          className={inputClass}
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="例: 30"
          min={1}
        />
      </div>

      <div className="mb-4">
        <label className="text-sm font-semibold text-gray-600 block mb-1.5">消費カロリー（kcal）</label>
        <input
          className={inputClass}
          type="number"
          value={burned}
          onChange={(e) => setBurned(e.target.value)}
          placeholder="例: 280"
          min={0}
        />
        <p className="text-xs text-gray-400 mt-1">※ 種目・時間を入力すると自動推定（上書き可）</p>
      </div>

      <div className="mb-4">
        <label className="text-sm font-semibold text-gray-600 block mb-1.5">メモ（任意）</label>
        <textarea
          className={`${inputClass} resize-none`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例: 朝のランニング・5km"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="w-full py-3 bg-[#FF7043] text-white font-bold rounded-xl text-sm hover:bg-[#F4511E] transition-colors"
      >
        保存する
      </button>
    </Modal>
  );
}
