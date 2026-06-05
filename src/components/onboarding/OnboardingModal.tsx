'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'fmt_onboarding_done';

const STEPS = [
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
      '「ジム」タブの START ボタンでタイマーが動き始めます。終了後に消費カロリーを入力して保存。目標（時間 or kcal）も設定できます。',
    accent: '#FF7043',
  },
  {
    emoji: '📊',
    title: 'データで振り返る',
    description:
      '「データ」タブでは週次カロリーグラフ・PFC栄養素の進捗・体重推移グラフ・カレンダーを確認できます。JSON/CSVエクスポートにも対応。',
    accent: '#42A5F5',
  },
  {
    emoji: '🎯',
    title: '目標を設定しよう',
    description:
      '食事タブ上部の「目標設定」から摂取カロリー目標を設定。体重目標・身長は「データ→体重→⚙️設定」から入力できます。さっそく始めましょう！',
    accent: '#AB47BC',
  },
] as const;

export default function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function finish() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  if (!show) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={finish} />

      {/* カード */}
      <div className="relative w-full max-w-sm mx-4 mb-4 md:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden">

        {/* カラーヘッダー */}
        <div
          className="flex flex-col items-center justify-center pt-10 pb-8 px-6"
          style={{ backgroundColor: current.accent + '18' }}
        >
          <span className="text-6xl mb-3 select-none">{current.emoji}</span>
          <h2 className="text-xl font-black text-gray-900 text-center leading-snug">
            {current.title}
          </h2>
        </div>

        {/* 説明文 */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-sm text-gray-600 leading-relaxed text-center">
            {current.description}
          </p>
        </div>

        {/* ステップインジケーター */}
        <div className="flex justify-center gap-2 py-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? '20px' : '8px',
                height: '8px',
                backgroundColor: i === step ? current.accent : '#E5E7EB',
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
            style={{ backgroundColor: current.accent }}
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
