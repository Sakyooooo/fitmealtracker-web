'use client';

import type { MealForm } from './useMealForm';
import { Field, NameSuggestions, MultiPickerSlot } from './mealFormParts';

/** クイックモード: 食事名＋カロリーだけの最短入力。 */
export default function QuickMealForm({ form }: { form: MealForm }) {
  const { name, handleNameInput, nameError, calories, setCalories, setCalError, setMultiText, calError, handleSave } = form;

  return (
    <>
      <Field label="食事名" error={nameError}>
        <input
          className={`input ${nameError ? 'border-red-400 focus:border-red-400' : ''}`}
          value={name}
          onChange={(e) => handleNameInput(e.target.value)}
          placeholder="例: サラダチキン・牛丼"
          maxLength={60}
          autoFocus
        />
      </Field>
      <NameSuggestions form={form} />
      <MultiPickerSlot form={form} />

      <Field label="カロリー（kcal）" error={calError}>
        <input
          className={`input ${calError ? 'border-red-400 focus:border-red-400' : ''}`}
          type="number"
          value={calories}
          onChange={(e) => { setCalories(e.target.value); setCalError(''); setMultiText(null); }}
          placeholder="例: 380"
          min={0}
        />
      </Field>

      <button
        type="button"
        onClick={handleSave}
        className="w-full mt-2 py-4 bg-[#4CAF50] text-white font-black rounded-2xl text-base tracking-wide hover:bg-[#43A047] transition-colors active:scale-95"
      >
        保存する
      </button>
      <p className="text-center text-xs text-gray-400 mt-3">
        時刻・区分・PFCを設定する場合は「✏️ 詳細」タブへ
      </p>
    </>
  );
}
