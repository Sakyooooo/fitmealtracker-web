'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { MealCategory, Recipe } from '@/lib/types';
import { combineRecipesForMeal, guessMealCategory } from '@/lib/recipe';

const CATEGORIES: MealCategory[] = ['朝食', '昼食', '夕食', '間食'];
const QTY_MIN = 0.5;
const QTY_MAX = 3;

type Props = {
  open: boolean;
  recipes: Recipe[];
  initialId: string | null;
  onClose: () => void;
  onRecord: (data: {
    name: string;
    calories: number;
    time: string;
    category: MealCategory;
    protein?: number;
    fat?: number;
    carbs?: number;
  }) => Promise<void> | void;
};

/** 複数レシピを選んで1件の食事（1投稿）として記録するモーダル。 */
export default function RecordRecipesModal({ open, recipes, initialId, onClose, onRecord }: Props) {
  // recipeId -> 人前数（未選択は Map に無い）
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [category, setCategory] = useState<MealCategory>('夕食');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Map(initialId ? [[initialId, 1]] : []));
    setCategory(guessMealCategory(new Date().getHours()));
    setSaving(false);
  }, [open, initialId]);

  const items = useMemo(
    () =>
      recipes
        .filter((r) => selected.has(r.id))
        .map((r) => ({ recipe: r, quantity: selected.get(r.id)! })),
    [recipes, selected],
  );
  const combined = useMemo(() => combineRecipesForMeal(items), [items]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, 1);
      return next;
    });
  }

  function changeQty(id: string, delta: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      const cur = next.get(id) ?? 1;
      next.set(id, Math.min(QTY_MAX, Math.max(QTY_MIN, Math.round((cur + delta) * 10) / 10)));
      return next;
    });
  }

  async function handleRecord() {
    if (items.length === 0 || saving) return;
    setSaving(true);
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    try {
      await onRecord({
        name: combined.name,
        calories: combined.calories,
        time,
        category,
        protein: combined.protein ?? undefined,
        fat: combined.fat ?? undefined,
        carbs: combined.carbs ?? undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="レシピから食事を記録">
      <div className="space-y-4">
        <p className="text-xs text-gray-400">
          複数のレシピを選ぶと、1件の食事としてまとめて記録されます
        </p>

        {/* ── レシピ選択リスト ── */}
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {recipes.map((recipe) => {
            const qty = selected.get(recipe.id);
            const isOn = qty != null;
            return (
              <div
                key={recipe.id}
                className={`rounded-xl border px-3 py-2.5 transition-colors ${
                  isOn ? 'border-[#4CAF50] bg-green-50/50' : 'border-gray-200'
                }`}
              >
                <button type="button" onClick={() => toggle(recipe.id)} className="w-full flex items-center gap-2.5 text-left">
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-white text-xs flex-shrink-0 ${
                      isOn ? 'bg-[#4CAF50]' : 'border-2 border-gray-300'
                    }`}
                  >
                    {isOn ? '✓' : ''}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-gray-800 truncate">{recipe.name}</span>
                    <span className="block text-[11px] text-gray-400">
                      {recipe.calories != null ? `${recipe.calories} kcal /1人前` : 'kcal 未設定'}
                    </span>
                  </span>
                </button>

                {/* 分量ステッパー（選択中のみ） */}
                {isOn && (
                  <div className="flex items-center justify-end gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => changeQty(recipe.id, -0.5)}
                      className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-600 font-bold hover:bg-gray-50"
                      aria-label="減らす"
                    >
                      −
                    </button>
                    <span className="text-sm font-bold text-gray-700 w-14 text-center">{qty} 人前</span>
                    <button
                      type="button"
                      onClick={() => changeQty(recipe.id, 0.5)}
                      className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-600 font-bold hover:bg-gray-50"
                      aria-label="増やす"
                    >
                      ＋
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── カテゴリ ── */}
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-1.5">カテゴリ</p>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                  category === c
                    ? 'bg-[#4CAF50] border-[#4CAF50] text-white'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── 合計プレビュー ── */}
        <div className="bg-gray-50 rounded-xl px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold text-gray-400">合計</span>
            <span className="text-lg font-bold text-gray-800">
              {combined.calories} <span className="text-xs font-semibold text-gray-400">kcal</span>
            </span>
          </div>
          {(combined.protein != null || combined.fat != null || combined.carbs != null) && (
            <p className="text-[11px] text-gray-400 text-right mt-0.5">
              P {combined.protein ?? '—'}g ・ F {combined.fat ?? '—'}g ・ C {combined.carbs ?? '—'}g
            </p>
          )}
          {items.length > 0 && (
            <p className="text-[11px] text-gray-500 mt-1 truncate">「{combined.name}」として記録します</p>
          )}
        </div>

        <button
          type="button"
          onClick={handleRecord}
          disabled={items.length === 0 || saving}
          className="w-full py-3 bg-[#4CAF50] text-white text-sm font-semibold rounded-xl hover:bg-[#43A047] disabled:opacity-50"
        >
          {saving ? '記録中…' : `🍽 ${items.length}品を記録する`}
        </button>
      </div>
    </Modal>
  );
}
