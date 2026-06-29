'use client';

import { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { AppSettings, Sex } from '@/lib/types';
import {
  computeNutritionPlan,
  daysUntil,
  ACTIVITY_OPTIONS,
} from '@/lib/nutritionPlan';

const ACCENT = '#AB47BC';
const inputClass =
  'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#AB47BC] bg-white';

const PERIOD_OPTIONS = [
  { months: 1, label: '1ヶ月' },
  { months: 2, label: '2ヶ月' },
  { months: 3, label: '3ヶ月' },
  { months: 6, label: '6ヶ月' },
  { months: 12, label: '1年' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  currentWeight: number | null;
  onApply: (patch: Partial<AppSettings>) => void;
};

/** 今日から nMonths 後の日付を "YYYY-MM-DD" で返す。 */
function addMonths(nMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + nMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function GoalPlannerModal({ open, onClose, settings, currentWeight, onApply }: Props) {
  const thisYear = new Date().getFullYear();

  const [sex, setSex] = useState<Sex | undefined>(settings.sex);
  const [ageStr, setAgeStr] = useState(settings.birthYear ? String(thisYear - settings.birthYear) : '');
  const [heightStr, setHeightStr] = useState(settings.heightCm ? String(settings.heightCm) : '');
  const [currentStr, setCurrentStr] = useState(currentWeight != null ? String(currentWeight) : '');
  const [targetStr, setTargetStr] = useState(settings.targetWeightKg ? String(settings.targetWeightKg) : '');
  const [months, setMonths] = useState(3);
  const [activity, setActivity] = useState(settings.activityLevel ?? 'light');

  const age = parseInt(ageStr, 10);
  const heightCm = parseFloat(heightStr);
  const currentWeightKg = parseFloat(currentStr);
  const targetWeightKg = parseFloat(targetStr);

  const valid =
    (sex === 'male' || sex === 'female') &&
    Number.isFinite(age) && age >= 10 && age <= 100 &&
    Number.isFinite(heightCm) && heightCm >= 100 && heightCm <= 250 &&
    Number.isFinite(currentWeightKg) && currentWeightKg > 0 && currentWeightKg <= 500 &&
    Number.isFinite(targetWeightKg) && targetWeightKg > 0 && targetWeightKg <= 500;

  const goalTargetDate = addMonths(months);

  const plan = useMemo(() => {
    if (!valid || !sex) return null;
    return computeNutritionPlan({
      sex, age, heightCm, currentWeightKg, targetWeightKg,
      activityLevel: activity,
      days: daysUntil(goalTargetDate),
    });
  }, [valid, sex, age, heightCm, currentWeightKg, targetWeightKg, activity, goalTargetDate]);

  function handleApply() {
    if (!plan || !sex) return;
    onApply({
      sex,
      birthYear: thisYear - age,
      heightCm,
      targetWeightKg,
      activityLevel: activity,
      goalTargetDate,
      targetIntakeCalories: plan.targetIntakeCalories,
      targetBurnedCalories: plan.targetBurnedCalories,
      targetProtein: plan.targetProtein,
      targetFat: plan.targetFat,
      targetCarbs: plan.targetCarbs,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="目標から自動で計算">
      <div className="space-y-4">
        <p className="text-xs text-gray-400 leading-relaxed">
          体格と目標を入力すると、1日の目標摂取カロリー・消費カロリー・PFCを自動で計算します。
        </p>

        {/* 性別 */}
        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-1.5">性別</label>
          <div className="flex gap-2">
            {([['male', '男性'], ['female', '女性']] as const).map(([v, l]) => (
              <button
                key={v} type="button" onClick={() => setSex(v)}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                  sex === v ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 bg-white'
                }`}
                style={sex === v ? { background: ACCENT } : undefined}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* 年齢・身長 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">年齢</label>
            <input className={inputClass} type="number" min={10} max={100} placeholder="例: 30"
              value={ageStr} onChange={(e) => setAgeStr(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">身長（cm）</label>
            <input className={inputClass} type="number" step="0.1" min={100} max={250} placeholder="例: 170"
              value={heightStr} onChange={(e) => setHeightStr(e.target.value)} />
          </div>
        </div>

        {/* 現在・目標体重 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">現在の体重（kg）</label>
            <input className={inputClass} type="number" step="0.1" min={1} max={500} placeholder="例: 65.0"
              value={currentStr} onChange={(e) => setCurrentStr(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">目標体重（kg）</label>
            <input className={inputClass} type="number" step="0.1" min={1} max={500} placeholder="例: 60.0"
              value={targetStr} onChange={(e) => setTargetStr(e.target.value)} />
          </div>
        </div>

        {/* 目標期間 */}
        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-1.5">目標期間</label>
          <div className="flex gap-2 flex-wrap">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.months} type="button" onClick={() => setMonths(p.months)}
                className={`flex-1 min-w-[56px] py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  months === p.months ? 'text-white border-transparent' : 'text-gray-500 border-gray-200 bg-white'
                }`}
                style={months === p.months ? { background: ACCENT } : undefined}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 活動量 */}
        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-1.5">普段の活動量</label>
          <div className="grid grid-cols-2 gap-2">
            {ACTIVITY_OPTIONS.map((a) => (
              <button
                key={a.value} type="button" onClick={() => setActivity(a.value)}
                className={`py-2.5 px-3 rounded-xl text-left border transition-colors ${
                  activity === a.value ? 'text-white border-transparent' : 'text-gray-600 border-gray-200 bg-white'
                }`}
                style={activity === a.value ? { background: ACCENT } : undefined}
              >
                <span className="block text-sm font-semibold">{a.label}</span>
                <span className={`block text-[11px] ${activity === a.value ? 'text-white/80' : 'text-gray-400'}`}>{a.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* プレビュー */}
        {plan ? (
          <div className="rounded-2xl p-4" style={{ background: '#F8F4FB' }}>
            <p className="text-xs font-black tracking-widest mb-3" style={{ color: ACCENT }}>計算結果</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <PreviewStat label="目標摂取カロリー" value={`${plan.targetIntakeCalories.toLocaleString()} kcal`} />
              <PreviewStat label="目標消費カロリー" value={`${plan.targetBurnedCalories.toLocaleString()} kcal`} />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <PreviewStat label="P (g)" value={String(plan.targetProtein)} small />
              <PreviewStat label="F (g)" value={String(plan.targetFat)} small />
              <PreviewStat label="C (g)" value={String(plan.targetCarbs)} small />
            </div>
            <p className="text-[11px] text-gray-400">
              基礎代謝 {plan.bmr.toLocaleString()} kcal ・ 維持カロリー {plan.tdee.toLocaleString()} kcal
            </p>
            {plan.warnings.map((w, i) => (
              <p key={i} className="text-[11px] text-amber-600 mt-2 leading-relaxed">⚠️ {w}</p>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-2">すべての項目を入力すると計算結果が表示されます</p>
        )}

        {/* ボタン */}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">
            キャンセル
          </button>
          <button type="button" onClick={handleApply} disabled={!plan}
            className="flex-1 py-3 text-white text-sm font-semibold rounded-xl disabled:opacity-40"
            style={{ background: ACCENT }}>
            この内容で設定
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PreviewStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-white rounded-xl px-3 py-2">
      <div className={`font-black text-gray-900 ${small ? 'text-base' : 'text-lg'}`}>{value}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
