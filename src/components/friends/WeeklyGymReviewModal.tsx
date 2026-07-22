'use client';

/**
 * 週の初めに1回表示するポップアップ:
 *  1. 先週の振り返り（宣言 vs 実績。宣言が無ければセクションごと省略）
 *  2. 今週の目標（曜日チップで宣言。あとで/保存どちらでも閉じられる）
 */

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { upsertMyPlan } from '@/lib/gymPlans';

const ACCENT = '#AB47BC';
const DONE = '#4CAF50';
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  /** 先週の宣言曜日（0..6）。空なら振り返りセクションは出さない */
  lastWeekPlanned: number[];
  /** 先週の実施曜日（0..6） */
  lastWeekDone: Set<number>;
  /** 今週の宣言の初期値（既に設定済みならそれ、無ければ空） */
  initialDays: number[];
};

export default function WeeklyGymReviewModal({
  open, onClose, lastWeekPlanned, lastWeekDone, initialDays,
}: Props) {
  const [days, setDays] = useState<number[]>(initialDays);
  const [saving, setSaving] = useState(false);

  function toggleDay(idx: number) {
    setDays((prev) => (prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()));
  }

  async function handleSave() {
    setSaving(true);
    await upsertMyPlan(days);
    setSaving(false);
    onClose();
  }

  const achievedCount = lastWeekPlanned.filter((d) => lastWeekDone.has(d)).length;
  const hasLastWeek = lastWeekPlanned.length > 0 || lastWeekDone.size > 0;
  const allAchieved = lastWeekPlanned.length > 0 && achievedCount === lastWeekPlanned.length;

  return (
    <Modal open={open} onClose={onClose} title="週の初め">
      {hasLastWeek && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-gray-400 tracking-widest uppercase">先週の振り返り</p>
            {lastWeekPlanned.length > 0 && (
              <span
                className="text-[11px] font-black px-2.5 py-1 rounded-full"
                style={{ background: '#F3E8FF', color: ACCENT }}
              >
                {achievedCount}/{lastWeekPlanned.length} 達成
              </span>
            )}
          </div>
          <div className="flex justify-between gap-1 mb-2">
            {DAY_LABELS.map((label, idx) => {
              const planned = lastWeekPlanned.includes(idx);
              const done = lastWeekDone.has(idx);
              return (
                <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                    style={done
                      ? { background: DONE, color: '#fff' }
                      : planned
                        ? { background: '#F3E8FF', color: ACCENT, boxShadow: `inset 0 0 0 2px ${ACCENT}` }
                        : { background: '#F9FAFB', color: '#D1D5DB' }}
                  >
                    {done ? '✓' : label}
                  </span>
                  <span className="text-[9px] font-bold text-gray-300">{label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs font-bold text-gray-500">
            {lastWeekPlanned.length === 0
              ? '先週は宣言していませんでしたが、実施日はありました。'
              : allAchieved
                ? '宣言した日を全部達成できました🎉'
                : `宣言した${lastWeekPlanned.length}日のうち${achievedCount}日、行けました。`}
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2">今週の目標</p>
        <div className="flex justify-between gap-1 mb-2">
          {DAY_LABELS.map((label, idx) => {
            const planned = days.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDay(idx)}
                className="flex flex-col items-center gap-1 flex-1"
                aria-label={`${label}曜日${planned ? 'の宣言を解除' : 'に行くと宣言'}`}
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all"
                  style={planned
                    ? { background: ACCENT, color: '#fff' }
                    : { background: '#F9FAFB', color: '#9CA3AF', boxShadow: 'inset 0 0 0 1.5px #E5E7EB' }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 font-bold">
          タップで行く日を選択。フレンドにも見えます（ジムタブでいつでも変更できます）。
        </p>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-400"
        >
          あとで
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || days.length === 0}
          className="flex-1 py-3 rounded-xl text-sm font-black text-white disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {saving ? '保存中…' : '今週の目標を保存'}
        </button>
      </div>
    </Modal>
  );
}
