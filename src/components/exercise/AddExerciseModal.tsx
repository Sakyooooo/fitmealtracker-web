'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { ExerciseEntry } from '@/lib/types';
import { todayString } from '@/lib/stats';
import { DEFAULT_PRESETS, estimateExerciseCalories } from '@/lib/activities';
import ActivityIcon from './ActivityIcon';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<ExerciseEntry, 'id'>) => void;
};

export default function AddExerciseModal({ open, onClose, onSave }: Props) {
  const [selected, setSelected] = useState('');
  const [customName, setCustomName] = useState('');
  const [duration, setDuration] = useState('');
  const [burned, setBurned] = useState('');
  const [note, setNote] = useState('');

  const activeName = selected === 'その他' ? customName : selected;

  useEffect(() => {
    const dur = parseInt(duration, 10);
    if (activeName.trim() && !isNaN(dur) && dur > 0) {
      setBurned(String(estimateExerciseCalories(activeName.trim(), dur)));
    }
  }, [activeName, duration]);

  function reset() {
    setSelected(''); setCustomName(''); setDuration(''); setBurned(''); setNote('');
  }
  function handleClose() { reset(); onClose(); }

  function handleSave() {
    if (!activeName.trim()) { alert('種目を選択してください'); return; }
    const dur = parseInt(duration, 10);
    if (isNaN(dur) || dur <= 0) { alert('時間（分）を入力してください'); return; }
    const cal = parseInt(burned, 10);
    if (isNaN(cal) || cal < 0) { alert('消費カロリーを確認してください'); return; }
    onSave({ name: activeName.trim(), durationMinutes: dur, caloriesBurned: cal,
             date: todayString(), note: note.trim(), type: 'normal' });
    reset(); onClose();
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#FF7043] bg-white';

  return (
    <Modal open={open} onClose={handleClose} title="運動を追加">

      {/* ── Activity grid ── */}
      <div className="mb-5">
        <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-2">種目</p>
        <div className="grid grid-cols-4 gap-1.5">
          {DEFAULT_PRESETS.map((name) => {
            const isActive = selected === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setSelected(isActive ? '' : name)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all
                  ${isActive
                    ? 'border-[#FF7043] bg-[#FFF3F0]'
                    : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}
              >
                <ActivityIcon name={name} size={48} />
                <span className={`text-[9px] font-semibold text-center leading-tight px-0.5
                  ${isActive ? 'text-[#FF7043]' : 'text-gray-400'}`}>
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected === 'その他' && (
        <div className="mb-4">
          <label className="text-xs font-bold text-gray-400 tracking-widest uppercase block mb-1.5">種目名</label>
          <input className={inputCls} value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="例: 縄跳び" maxLength={40} autoFocus />
        </div>
      )}

      <div className="mb-4">
        <label className="text-xs font-bold text-gray-400 tracking-widest uppercase block mb-1.5">時間（分）</label>
        <input className={inputCls} type="number" value={duration}
          onChange={(e) => setDuration(e.target.value)} placeholder="例: 30" min={1} />
      </div>

      <div className="mb-4">
        <label className="text-xs font-bold text-gray-400 tracking-widest uppercase block mb-1.5">消費カロリー（kcal）</label>
        <input className={inputCls} type="number" value={burned}
          onChange={(e) => setBurned(e.target.value)} placeholder="例: 280" min={0} />
        <p className="text-xs text-gray-400 mt-1">種目・時間を入力すると自動推定（上書き可）</p>
      </div>

      <div className="mb-5">
        <label className="text-xs font-bold text-gray-400 tracking-widest uppercase block mb-1.5">メモ（任意）</label>
        <textarea className={`${inputCls} resize-none`} rows={2} value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="例: 朝のランニング・5km" />
      </div>

      <button type="button" onClick={handleSave}
        className="w-full py-3 bg-[#FF7043] text-white font-bold rounded-xl text-sm hover:bg-[#F4511E] transition-colors">
        保存する
      </button>
    </Modal>
  );
}
