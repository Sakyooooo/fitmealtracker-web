'use client';

import { useState, useEffect } from 'react';
import { loadSettings, saveSettings } from '@/lib/localRepository';

const STORAGE_KEY = 'fmt_onboarding_done';

const INFO_STEPS = [
  {
    emoji: '📷',
    title: '食事をカメラで記録',
    description:
      '「食事」タブの RECORD ボタンをタップ。写真を撮るだけで AI がカロリーと食事名を自動入力します。左のカメラアイコンなら撮影して即解析！',
    accent: '#4CAF50',
  },
  {
    emoji: '🏋️',
    title: 'ジムセッションを計測',
    description:
      '「ジム」タブの START ボタンでタイマーが動き始めます。終了後に消費カロリーと種目・重量を入力して保存。目標（時間 or kcal）も設定できます。',
    accent: '#FF7043',
  },
  {
    emoji: '📊',
    title: 'データで振り返る',
    description:
      '「データ」タブでは週次カロリーグラフ・PFC栄養素の進捗・体重推移グラフ・カレンダーを確認できます。JSON/CSVエクスポートにも対応。',
    accent: '#42A5F5',
  },
] as const;

const TOTAL_STEPS = INFO_STEPS.length + 1; // +1 for goal step

export default function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  // Goal step inputs
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetCalories, setTargetCalories] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  function handleNext() {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function finish() {
    // Save entered goals to AppSettings
    const settings = loadSettings();
    const cw = parseFloat(currentWeight);
    const tw = parseFloat(targetWeight);
    const tc = parseInt(targetCalories, 10);
    saveSettings({
      ...settings,
      ...(isFinite(cw) && cw > 0 ? {} : {}), // currentWeight is for WeightEntry, not AppSettings
      ...(isFinite(tw) && tw > 0 ? { targetWeightKg: tw } : {}),
      ...(isFinite(tc) && tc > 0 ? { targetIntakeCalories: tc } : {}),
    });
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  if (!show) return null;

  const isGoalStep = step === INFO_STEPS.length;
  const isLast = step === TOTAL_STEPS - 1;
  const current = !isGoalStep ? INFO_STEPS[step] : null;
  const accent = current?.accent ?? '#AB47BC';

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={finish} />

      {/* カード */}
      <div className="relative w-full max-w-sm mx-4 mb-4 md:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* カラーヘッダー */}
        <div
          className="flex flex-col items-center justify-center pt-10 pb-8 px-6"
          style={{ backgroundColor: accent + '18' }}
        >
          <span className="text-6xl mb-3 select-none">
            {isGoalStep ? '🎯' : current!.emoji}
          </span>
          <h2 className="text-xl font-black text-gray-900 text-center leading-snug">
            {isGoalStep ? '目標を設定しよう' : current!.title}
          </h2>
        </div>

        {/* コンテンツ */}
        <div className="px-6 pt-5 pb-2">
          {isGoalStep ? (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 text-center mb-4">
                あとから「データ」タブの設定でも変更できます
              </p>
              <div>
                <label className="text-xs font-bold tracking-widest text-gray-400 block mb-1">現在の体重（kg）</label>
                <input
                  type="number" min={0} step={0.1} placeholder="例: 65.0"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base font-black text-gray-900 focus:outline-none focus:border-[#AB47BC] tabular-nums"
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-gray-400 block mb-1">目標体重（kg）</label>
                <input
                  type="number" min={0} step={0.1} placeholder="例: 60.0"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base font-black text-gray-900 focus:outline-none focus:border-[#AB47BC] tabular-nums"
                />
              </div>
              <div>
                <label className="text-xs font-bold tracking-widest text-gray-400 block mb-1">目標摂取カロリー（kcal/日）</label>
                <input
                  type="number" min={0} step={50} placeholder="例: 1800"
                  value={targetCalories}
                  onChange={(e) => setTargetCalories(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base font-black text-gray-900 focus:outline-none focus:border-[#AB47BC] tabular-nums"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed text-center">
              {current!.description}
            </p>
          )}
        </div>

        {/* ステップインジケーター */}
        <div className="flex justify-center gap-2 py-4">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? '20px' : '8px',
                height: '8px',
                backgroundColor: i === step ? accent : '#E5E7EB',
              }}
            />
          ))}
        </div>

        {/* ボタン */}
        <div className="px-6 pb-8 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleNext}
            className="w-full py-4 rounded-2xl text-white font-black text-base tracking-wide transition-colors active:scale-95"
            style={{ backgroundColor: accent }}
          >
            {isLast ? 'さっそく始める 🚀' : '次へ →'}
          </button>
          <button
            type="button"
            onClick={finish}
            className="w-full py-2 text-gray-400 text-sm font-medium"
          >
            スキップ
          </button>
        </div>
      </div>
    </div>
  );
}
