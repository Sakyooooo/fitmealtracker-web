'use client';

import { NutritionBasis } from '@/lib/types';
import MultiDishPicker from '@/components/meal/MultiDishPicker';
import type { MealForm, TagFriend } from './useMealForm';

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
 * 一緒に食べたフレンドのタグ付け。クイック・詳細の両モードで共有する。
 * タグ付けした相手のタイムラインには「自分の記録にシェア」ボタンが表示される。
 * 承認済みフレンドが居ないときは何も表示しない。
 */
export function FriendTagPanel({ form, friends }: { form: MealForm; friends: TagFriend[] }) {
  const { taggedUserIds, setTaggedUserIds } = form;
  if (friends.length === 0) return null;

  const toggle = (id: string) =>
    setTaggedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  return (
    <Field label="一緒に食べたフレンド（任意）">
      <p className="text-xs text-gray-400 mb-2 -mt-1">
        タグ付けした相手は、この記録を自分の記録としてシェアできます。
      </p>
      <div className="flex gap-2 flex-wrap">
        {friends.map((f) => {
          const on = taggedUserIds.includes(f.id);
          const initial = f.name.charAt(0).toUpperCase();
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => toggle(f.id)}
              className={`flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full text-sm font-medium border-2 transition-colors ${
                on
                  ? 'bg-[#AB47BC] border-[#AB47BC] text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center overflow-hidden text-[11px] font-black"
                style={{ background: on ? 'rgba(255,255,255,0.25)' : '#F3E8FF', color: on ? '#fff' : '#AB47BC' }}
              >
                {f.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </span>
              {f.name}
              {on && <span className="text-xs">✓</span>}
            </button>
          );
        })}
      </div>
    </Field>
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

  // 候補一覧とAI推定ボタンは併記する。「ジェノベーゼパスタ」→部分一致で
  // 「パスタ」しか候補に無くても、正確な料理名でAI推定できる選択肢を残すため
  // (以前は候補が1件でもあるとAIボタンが完全に隠れていた)。
  // 入力と完全一致する候補が既にあるか、既にこの名前でAI推定済みならAIボタンは省く。
  const exactMatch = nameSuggestions.some((s) => s.label === q);
  const alreadyAi = basis?.origin === 'ai' && basis.name === q;
  const showAiButton = q.length >= 2 && !exactMatch && !alreadyAi;

  if (nameSuggestions.length === 0 && !showAiButton) return null;

  return (
    <div className="-mt-2 mb-4 space-y-2">
      {nameSuggestions.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
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
      )}
      {showAiButton && (
        <button
          type="button"
          onClick={runAiEstimate}
          disabled={estimatingName}
          className="w-full py-2.5 border-2 border-dashed border-amber-300 rounded-xl text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-60"
        >
          {estimatingName ? '🤖 AIが推定中…' : `🤖 「${q}」を正確にAIでカロリー推定`}
        </button>
      )}
    </div>
  );
}

/** 複数料理ピッカー（multiText がセットされているときのみ表示）。 */
export function MultiPickerSlot({ form }: { form: MealForm }) {
  const { multiText, myFoods, handleMultiChange } = form;
  if (!multiText) return null;
  return <MultiDishPicker initialText={multiText} myFoods={myFoods} onChange={handleMultiChange} />;
}
