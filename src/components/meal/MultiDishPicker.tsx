'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MyFood, NutritionBasis, FoodCompositionItem } from '@/lib/types';
import { searchDishes } from '@/lib/nutritionDb';
import { searchFoods } from '@/lib/foodComposition';
import {
  scaleNutrition, basisFromDish, basisFromMyFood, basisFromFood, basisFromAnalysis, basisFromAiCache,
} from '@/lib/portion';
import { estimateMealByNameCached, searchAiCache, type AiCacheItem } from '@/lib/aiNutrition';

type Cand = { label: string; sub: string; basis: NutritionBasis };
type Row = {
  id: string;
  query: string;
  candidates: Cand[];
  basis: NutritionBasis | null; // 選択中（分量込み）
  showCandidates: boolean;
  aiLoading: boolean;
  aiTried: boolean;
};

export type MultiTotal = {
  kcal: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  names: string[];
};

type Props = {
  /** 入力テキスト（例:「ごはんと麻婆茄子」）。マウント時に分解して行を作る。 */
  initialText: string;
  myFoods: MyFood[];
  onChange: (total: MultiTotal) => void;
};

let rowSeq = 0;
const nextId = () => `row-${++rowSeq}`;

/** 区切り（、,・/＋ 空白 改行）と語中の「と/や」で分割。語頭の「と」(とんかつ等)は割らない。 */
function splitComponents(text: string): string[] {
  return text
    .split(/[、,，・/／＋+&＆\s　\n]+|(?<=.)(?:と|や)(?=.)/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1);
}

/** マッチング用の正規化（nutritionDb と同方針）。 */
function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s　・、,，.．。!！?？]/g, '').trim();
}

function buildCandidates(query: string, myFoods: MyFood[]): Cand[] {
  const out: Cand[] = [];
  const seen = new Set<string>();
  const push = (label: string, sub: string, basis: NutritionBasis) => {
    if (seen.has(label) || out.length >= 6) return;
    seen.add(label); out.push({ label, sub, basis });
  };
  for (const d of searchDishes(query, 5)) push(d.name, `${d.kcal}kcal / ${d.serving}`, basisFromDish(d));
  for (const f of myFoods.filter((m) => m.name.includes(query)).slice(0, 3)) {
    push(f.name, `${f.calories}kcal · マイ食品`, basisFromMyFood(f));
  }
  return out;
}

export default function MultiDishPicker({ initialText, myFoods, onChange }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const builtFor = useRef<string>('');

  // 入力テキストから行を構築（候補の上位を自動選択。成分表は非同期で補完）
  useEffect(() => {
    if (builtFor.current === initialText) return;
    builtFor.current = initialText;
    const comps = splitComponents(initialText);
    const initial: Row[] = comps.map((q) => {
      const candidates = buildCandidates(q, myFoods);
      // 料理名そのものが完全一致するときだけ自動適用。それ以外は候補から選ばせる。
      const exact = candidates.find((c) => normalizeKey(c.label) === normalizeKey(q)) ?? null;
      return {
        id: nextId(),
        query: q,
        candidates,
        basis: exact ? exact.basis : null,
        showCandidates: !exact, // 完全一致でなければ候補を開いて表示
        aiLoading: false,
        aiTried: false,
      };
    });
    setRows(initial);

    // 成分表（八訂）＋ AI推定キャッシュ（過去にAI推定済みの料理）を非同期で候補に追加
    comps.forEach((q, idx) => {
      const qKey = normalizeKey(q);
      Promise.all([searchFoods(q, 4), searchAiCache(q, 4)])
        .then(([foods, aiItems]: [FoodCompositionItem[], AiCacheItem[]]) => {
          if (foods.length === 0 && aiItems.length === 0) return;
          setRows((prev) => prev.map((r, i) => {
            if (i !== idx || r.id == null) return r;
            const seen = new Set(r.candidates.map((c) => c.label));
            const add: Cand[] = [];
            for (const it of foods) {
              if (seen.has(it.name) || r.candidates.length + add.length >= 8) continue;
              seen.add(it.name);
              add.push({ label: it.name, sub: `${it.kcal}kcal / 100g`, basis: basisFromFood(it) });
            }
            for (const a of aiItems) {
              if (seen.has(a.name) || r.candidates.length + add.length >= 8) continue;
              seen.add(a.name);
              add.push({ label: a.name, sub: `${a.kcal}kcal・AI推定済み`, basis: basisFromAiCache(a) });
            }
            if (add.length === 0) return r;
            const candidates = [...r.candidates, ...add];
            // 未選択なら自動適用する。同じ料理名でAI推定済み（キー完全一致）を最優先、
            // 無ければ成分表側の完全一致（先頭の自動選択はしない）。
            let basis = r.basis;
            let showCandidates = r.showCandidates;
            if (!basis) {
              const exactAi = aiItems.find((a) => a.nameKey === qKey);
              if (exactAi) {
                basis = basisFromAiCache(exactAi);
                showCandidates = false;
              } else {
                const exact = candidates.find((c) => normalizeKey(c.label) === normalizeKey(r.query));
                if (exact) { basis = exact.basis; showCandidates = false; }
              }
            }
            return { ...r, candidates, basis, showCandidates };
          }));
        }).catch(() => {});
    });
  }, [initialText, myFoods]);

  // 合計を算出して親へ通知
  useEffect(() => {
    const total: MultiTotal = { kcal: 0, protein: null, fat: null, carbs: null, names: [] };
    let hasP = false, hasF = false, hasC = false;
    let sumP = 0, sumF = 0, sumC = 0;
    for (const r of rows) {
      total.names.push(r.basis?.name ?? r.query);
      if (!r.basis) continue;
      const v = scaleNutrition(r.basis);
      total.kcal += v.kcal;
      if (v.p != null) { hasP = true; sumP += v.p; }
      if (v.f != null) { hasF = true; sumF += v.f; }
      if (v.c != null) { hasC = true; sumC += v.c; }
    }
    total.protein = hasP ? Math.round(sumP) : null;
    total.fat = hasF ? Math.round(sumF) : null;
    total.carbs = hasC ? Math.round(sumC) : null;
    onChange(total);
  }, [rows, onChange]);

  const setRow = useCallback((id: string, patch: Partial<Row> | ((r: Row) => Partial<Row>)) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r)));
  }, []);

  function pick(id: string, c: Cand) {
    setRow(id, { basis: c.basis, showCandidates: false });
  }
  function updateQuantity(id: string, q: number) {
    setRow(id, (r) => (r.basis ? { basis: { ...r.basis, quantity: q } } : {}));
  }
  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  async function runRowAi(id: string, query: string) {
    setRow(id, { aiLoading: true });
    const result = await estimateMealByNameCached(query);
    const b = basisFromAnalysis(result);
    setRow(id, b ? { basis: b, aiLoading: false, aiTried: true } : { aiLoading: false, aiTried: true });
  }

  if (rows.length === 0) return null;

  return (
    <div className="-mt-2 mb-4 space-y-2">
      <p className="text-[11px] font-bold text-blue-700">🍱 料理ごとに選択（合計を1件として保存）</p>
      {rows.map((r) => {
        const v = r.basis ? scaleNutrition(r.basis) : null;
        const unit = r.basis?.unit;
        // 候補に完全一致が無ければ、部分一致しかない/候補が無いのどちらでもAI推定を選択肢として残す
        // （以前は候補が1件でもあるとAI推定が完全に隠れ、微妙に違う料理名のとき融通が利かなかった）
        const exactMatch = r.candidates.some((c) => normalizeKey(c.label) === normalizeKey(r.query));
        const showAiChip = !exactMatch;
        return (
          <div key={r.id} className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-black text-blue-900 truncate">{r.basis?.name ?? r.query}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {v && <span className="text-xs font-bold text-blue-700 tabular-nums">{v.kcal}kcal</span>}
                <button type="button" onClick={() => removeRow(r.id)} className="text-blue-300 hover:text-red-400 leading-none" aria-label="除外">×</button>
              </div>
            </div>

            {/* 分量スライダー（選択済みのとき） */}
            {r.basis && (
              <>
                <input
                  type="range"
                  min={unit === 'serving' ? 0.25 : 10}
                  max={unit === 'serving' ? 4 : 500}
                  step={unit === 'serving' ? 0.25 : 10}
                  value={r.basis.quantity}
                  onChange={(e) => updateQuantity(r.id, parseFloat(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex items-center justify-between text-[11px] text-blue-700">
                  <span>{unit === 'serving' ? `${r.basis.quantity} ${r.basis.unitLabel}` : `${r.basis.quantity} g`}</span>
                  <button type="button" onClick={() => setRow(r.id, (x) => ({ showCandidates: !x.showCandidates }))}
                    className="font-bold underline decoration-dotted">
                    {r.candidates.length > 0 || showAiChip ? '候補を変更' : ''}
                  </button>
                </div>
              </>
            )}

            {/* 候補リスト（未選択 or 変更時）＋ 完全一致が無ければAI推定も選択肢の一つとして並べる */}
            {(r.showCandidates || !r.basis) && (r.candidates.length > 0 || showAiChip) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {r.candidates.map((c) => {
                  const active = r.basis?.name === c.label;
                  return (
                    <button key={c.label} type="button" onClick={() => pick(r.id, c)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-800 border-blue-300 hover:bg-blue-100'
                      }`}>
                      {c.label}
                    </button>
                  );
                })}
                {showAiChip && (
                  <button type="button" onClick={() => runRowAi(r.id, r.query)} disabled={r.aiLoading}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors disabled:opacity-60 ${
                      r.basis?.origin === 'ai'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'border-dashed border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100'
                    }`}>
                    {r.aiLoading ? '🤖 推定中…' : r.aiTried ? '🤖 もう一度AI推定' : '🤖 AIで推定'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
