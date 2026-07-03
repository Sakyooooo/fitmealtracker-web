'use client';

import { NutritionBasis } from '@/lib/types';
import MultiDishPicker from '@/components/meal/MultiDishPicker';
import type { MealForm } from './useMealForm';

export const ORIGIN_LABEL: Record<NutritionBasis['origin'], string> = {
  ai: '🤖 AI推定',
  db: '📋 成分表(料理)',
  off: '📦 Open Food Facts',
  composition: '🥗 食品成分表',
  myfood: '⭐ マイ食品',
};

/** ラベル付きフォーム行。 */
export function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="mb-4">
      <label className="text-sm font-semibold text-gray-600 block mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
}

/**
 * 食事名入力の下に出る候補群。
 * - 複数料理の入力を検知したら「分けて入力」ボタン
 * - DB/マイ食品/成分表の候補リスト
 * - 候補が無ければ AI推定ボタン
 * クイック・詳細の両モードで共有する。
 */
export function NameSuggestions({ form }: { form: MealForm }) {
  const {
    name, multiText, setMultiText, nameSuggestions, pickSuggestion,
    runAiEstimate, estimatingName, basis,
  } = form;
  const q = name.trim();

  // 複数ピッカー表示中はサジェストを出さない
  if (multiText) return null;

  // 複数料理の入力（区切り or 語中の「と/や」）→ 「分けて入力」ボタンを表示
  const multiIntent = q.length >= 2 && (/[、,，・/／＋+&＆\n]/u.test(q) || /.+(と|や).+/u.test(q));
  if (multiIntent) {
    return (
      <div className="-mt-2 mb-4">
        <button
          type="button"
          onClick={() => setMultiText(name.trim())}
          className="w-full py-2.5 border-2 border-dashed border-blue-300 rounded-xl text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          🍱 複数の料理を分けて入力（候補から選択）
        </button>
      </div>
    );
  }

  if (nameSuggestions.length > 0) {
    return (
      <div className="-mt-2 mb-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <p className="text-[10px] text-gray-400 px-3 pt-2 pb-1">候補（タップでカロリーを反映）</p>
        <ul className="max-h-44 overflow-y-auto divide-y divide-gray-100">
          {nameSuggestions.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => pickSuggestion(s)}
                className="w-full text-left py-2 px-3 hover:bg-green-50 flex justify-between gap-2 items-center"
              >
                <span className="text-xs text-gray-700 truncate">{s.label}</span>
                <span className="text-[11px] text-gray-400 shrink-0">{s.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // 候補が無いとき: AI推定ボタン（既にこの名前でAI推定済みなら出さない）
  const alreadyAi = basis?.origin === 'ai' && basis.name === q;
  if (q.length >= 2 && !alreadyAi) {
    return (
      <div className="-mt-2 mb-4">
        <button
          type="button"
          onClick={runAiEstimate}
          disabled={estimatingName}
          className="w-full py-2.5 border-2 border-dashed border-amber-300 rounded-xl text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-60"
        >
          {estimatingName ? '🤖 AIが推定中…' : `🤖 「${q}」をAIでカロリー推定`}
        </button>
      </div>
    );
  }
  return null;
}

/** 複数料理ピッカー（multiText がセットされているときのみ表示）。 */
export function MultiPickerSlot({ form }: { form: MealForm }) {
  const { multiText, myFoods, handleMultiChange } = form;
  if (!multiText) return null;
  return <MultiDishPicker initialText={multiText} myFoods={myFoods} onChange={handleMultiChange} />;
}
