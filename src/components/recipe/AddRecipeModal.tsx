'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Recipe, RecipeSource } from '@/lib/types';
import { extractYouTubeVideoId, RecipeAnalysisResult } from '@/lib/recipe';
import { analyzeRecipeByYoutube, analyzeRecipeByText } from '@/lib/recipeAnalysis';
import { NewRecipe } from '@/hooks/useRecipes';

type Mode = 'youtube' | 'text' | 'manual';
type Phase = 'input' | 'edit';

type Props = {
  open: boolean;
  editing?: Recipe | null; // 既存レシピの編集（手入力フォームに直行）
  onClose: () => void;
  onSave: (data: NewRecipe) => void;
  onUpdate: (recipe: Recipe) => void;
};

type IngredientRow = { name: string; amount: string };

const MODES: { id: Mode; label: string }[] = [
  { id: 'youtube', label: '▶ YouTube' },
  { id: 'text',    label: '📋 テキスト' },
  { id: 'manual',  label: '✍️ 手入力' },
];

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9800]/40';

export default function AddRecipeModal({ open, editing, onClose, onSave, onUpdate }: Props) {
  const [mode, setMode] = useState<Mode>('youtube');
  const [phase, setPhase] = useState<Phase>('input');

  // 解析入力
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 編集フォーム
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ name: '', amount: '' }]);
  const [stepsText, setStepsText] = useState('');
  const [cal, setCal] = useState('');
  const [prot, setProt] = useState('');
  const [fatV, setFatV] = useState('');
  const [carb, setCarb] = useState('');
  const [note, setNote] = useState('');
  const [sourceInfo, setSourceInfo] = useState<{ type: RecipeSource; url: string | null }>({ type: 'manual', url: null });

  function resetForm() {
    setName('');
    setServings('1');
    setIngredients([{ name: '', amount: '' }]);
    setStepsText('');
    setCal(''); setProt(''); setFatV(''); setCarb('');
    setNote('');
    setSourceInfo({ type: 'manual', url: null });
  }

  // 開くたびに初期化（編集時はフォームへプリフィルして直行）
  useEffect(() => {
    if (!open) return;
    setAnalyzing(false);
    setError(null);
    setUrl('');
    setPasteText('');
    if (editing) {
      setMode('manual');
      setPhase('edit');
      setName(editing.name);
      setServings(String(editing.servings));
      setIngredients(
        editing.ingredients.length > 0
          ? editing.ingredients.map((i) => ({ name: i.name, amount: i.amount ?? '' }))
          : [{ name: '', amount: '' }],
      );
      setStepsText(editing.steps.join('\n'));
      setCal(editing.calories != null ? String(editing.calories) : '');
      setProt(editing.protein != null ? String(editing.protein) : '');
      setFatV(editing.fat != null ? String(editing.fat) : '');
      setCarb(editing.carbs != null ? String(editing.carbs) : '');
      setNote(editing.note ?? '');
      setSourceInfo({ type: editing.sourceType, url: editing.sourceUrl ?? null });
    } else {
      setMode('youtube');
      setPhase('input');
      resetForm();
    }
  }, [open, editing]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    if (m === 'manual') {
      resetForm();
      setPhase('edit');
    } else {
      setPhase('input');
    }
  }

  function fillFromAnalysis(result: RecipeAnalysisResult, type: RecipeSource, srcUrl: string | null) {
    setName(result.name ?? '');
    setServings(String(result.servings));
    setIngredients(
      result.ingredients.length > 0
        ? result.ingredients.map((i) => ({ name: i.name, amount: i.amount ?? '' }))
        : [{ name: '', amount: '' }],
    );
    setStepsText(result.steps.join('\n'));
    setCal(result.calories != null ? String(result.calories) : '');
    setProt(result.protein != null ? String(result.protein) : '');
    setFatV(result.fat != null ? String(result.fat) : '');
    setCarb(result.carbs != null ? String(result.carbs) : '');
    setNote('');
    setSourceInfo({ type, url: srcUrl });
    setPhase('edit');
  }

  async function handleAnalyze() {
    setError(null);
    if (mode === 'youtube') {
      if (!extractYouTubeVideoId(url)) {
        setError('YouTube の動画URLを入力してください（watch / youtu.be / shorts に対応）');
        return;
      }
    } else if (!pasteText.trim()) {
      setError('レシピ文を貼り付けてください');
      return;
    }

    setAnalyzing(true);
    const res = mode === 'youtube'
      ? await analyzeRecipeByYoutube(url)
      : await analyzeRecipeByText(pasteText);
    setAnalyzing(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (!res.result.name) {
      setError(res.result.notes ?? 'レシピを抽出できませんでした。別の動画・テキストでお試しください。');
      return;
    }
    fillFromAnalysis(res.result, mode, mode === 'youtube' ? url.trim() : null);
  }

  const toNumOrNull = (s: string): number | null => {
    const n = parseFloat(s);
    return isFinite(n) && n >= 0 ? n : null;
  };

  function handleSave() {
    if (!name.trim()) {
      setError('料理名を入力してください');
      return;
    }
    const servingsNum = Math.max(1, Math.min(20, Math.round(parseFloat(servings) || 1)));
    const data: NewRecipe = {
      name: name.trim().slice(0, 60),
      servings: servingsNum,
      ingredients: ingredients
        .map((i) => ({ name: i.name.trim(), amount: i.amount.trim() || null }))
        .filter((i) => i.name !== ''),
      steps: stepsText.split('\n').map((s) => s.trim()).filter((s) => s !== ''),
      calories: toNumOrNull(cal) != null ? Math.round(toNumOrNull(cal)!) : null,
      protein: toNumOrNull(prot),
      fat: toNumOrNull(fatV),
      carbs: toNumOrNull(carb),
      sourceType: sourceInfo.type,
      sourceUrl: sourceInfo.url,
      note: note.trim() || null,
    };
    if (editing) {
      onUpdate({ ...editing, ...data });
    } else {
      onSave(data);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'レシピを編集' : 'レシピを追加'}>
      {/* ── モード切り替え（編集時は非表示） ── */}
      {!editing && (
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => switchMode(m.id)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                mode === m.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {/* ── 解析入力（YouTube / テキスト） ── */}
      {phase === 'input' && mode === 'youtube' && (
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-600 block">
            動画のURL
            <input
              className={`${inputClass} mt-1.5`}
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={analyzing}
            />
          </label>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            AIが動画を解析して、料理名・材料・手順・栄養（1人前）を自動で抽出します。
            公開動画のみ対応。動画の長さによって解析に時間がかかることがあります。
          </p>
        </div>
      )}

      {phase === 'input' && mode === 'text' && (
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-600 block">
            レシピ文・概要欄の貼り付け
            <textarea
              className={`${inputClass} mt-1.5 min-h-[140px]`}
              placeholder={'例:\n【材料 2人前】\n豚こま肉 200g\nじゃがいも 3個\n...\n\nTikTok や Instagram のキャプションもOK'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              disabled={analyzing}
              maxLength={4000}
            />
          </label>
          <p className="text-[11px] text-gray-400">AIがレシピの形に整形し、栄養（1人前）も推定します。</p>
        </div>
      )}

      {phase === 'input' && (
        <>
          {error && <p className="text-xs font-semibold text-red-500 mt-3">{error}</p>}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full mt-4 py-3 bg-[#FF9800] text-white text-sm font-semibold rounded-xl hover:bg-[#FB8C00] disabled:opacity-60"
          >
            {analyzing ? '解析中…（最大1分ほどかかります）' : '🔍 AIで解析する'}
          </button>
        </>
      )}

      {/* ── 編集フォーム ── */}
      {phase === 'edit' && (
        <div className="space-y-4">
          {sourceInfo.type !== 'manual' && !editing && (
            <p className="text-[11px] font-semibold text-[#FF9800] bg-orange-50 rounded-lg px-3 py-2">
              ✨ AIの解析結果です。内容を確認・修正してから保存してください。
            </p>
          )}

          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">料理名 *</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 肉じゃが" maxLength={60} />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">何人前のレシピか</label>
            <input className={inputClass} type="number" min={1} max={20} value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">材料</label>
            <div className="space-y-2">
              {ingredients.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={`${inputClass} flex-[2]`}
                    placeholder="材料名"
                    value={row.name}
                    onChange={(e) => setIngredients((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  />
                  <input
                    className={`${inputClass} flex-1`}
                    placeholder="分量"
                    value={row.amount}
                    onChange={(e) => setIngredients((prev) => prev.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))}
                  />
                  <button
                    type="button"
                    onClick={() => setIngredients((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                    className="w-9 flex-shrink-0 flex items-center justify-center text-gray-300 hover:text-red-400 text-lg"
                    aria-label="材料を削除"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIngredients((prev) => [...prev, { name: '', amount: '' }])}
              className="mt-2 text-xs font-bold text-[#FF9800] hover:text-[#FB8C00]"
            >
              ＋ 材料を追加
            </button>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">手順（1行 = 1ステップ）</label>
            <textarea
              className={`${inputClass} min-h-[110px]`}
              placeholder={'じゃがいもを一口大に切る\n油を熱し豚肉を炒める\n…'}
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">栄養（1人前あたり）</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { ph: 'kcal', val: cal, set: setCal },
                { ph: 'P (g)', val: prot, set: setProt },
                { ph: 'F (g)', val: fatV, set: setFatV },
                { ph: 'C (g)', val: carb, set: setCarb },
              ].map(({ ph, val, set }) => (
                <input
                  key={ph}
                  className="w-full px-2 py-2.5 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#FF9800]/40"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  placeholder={ph}
                  value={val}
                  onChange={(e) => set(e.target.value)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600 block mb-1.5">メモ（任意）</label>
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="コツ・アレンジなど" maxLength={200} />
          </div>

          {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-3 bg-[#FF9800] text-white text-sm font-semibold rounded-xl hover:bg-[#FB8C00]"
            >
              {editing ? '更新する' : '保存する'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
