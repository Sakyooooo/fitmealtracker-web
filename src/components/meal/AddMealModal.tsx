'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal';
import {
  MealCategory, MealEntry, MealAnalysisResult, ProductLookupResult,
  FoodCompositionItem, NutritionBasis,
} from '@/lib/types';
import { todayString } from '@/lib/stats';
import { analyzeMealPhotoCached, estimateMealByNameCached } from '@/lib/aiNutrition';
import MultiDishPicker, { type MultiTotal } from '@/components/meal/MultiDishPicker';
import { lookupProductByBarcode } from '@/lib/openFoodFacts';
import { searchFoods } from '@/lib/foodComposition';
import { searchDishes } from '@/lib/nutritionDb';
import {
  scaleNutrition, basisFromAnalysis, basisFromProduct, basisFromFood, basisFromMyFood, basisFromDish,
} from '@/lib/portion';
import { useMyFoods } from '@/hooks/useMyFoods';

type NameSuggestion = { key: string; label: string; sub: string; basis: NutritionBasis };

const BarcodeScanner = dynamic(() => import('@/components/meal/BarcodeScanner'), { ssr: false });

const ORIGIN_LABEL: Record<NutritionBasis['origin'], string> = {
  ai: '🤖 AI推定',
  db: '📋 成分表(料理)',
  off: '📦 Open Food Facts',
  composition: '🥗 食品成分表',
  myfood: '⭐ マイ食品',
};

function parseNum(s: string): number | null {
  const v = parseFloat(s);
  return !isNaN(v) && v >= 0 ? v : null;
}

type Mode = 'quick' | 'detail';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (
    data: Omit<MealEntry, 'id' | 'photoUri' | 'photoId'> & { photoFile?: File | null },
  ) => void;
  initialPhotoFile?: File | null;
  initialAnalysis?: MealAnalysisResult | null;
};

const CATEGORIES: MealCategory[] = ['朝食', '昼食', '夕食', '間食'];

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function AddMealModal({ open, onClose, onSave, initialPhotoFile, initialAnalysis }: Props) {
  // ── モード ────────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('quick');

  // ── フォーム状態 ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [date, setDate] = useState(todayString);
  const [time, setTime] = useState(nowTime);
  const [category, setCategory] = useState<MealCategory>('朝食');
  const [note, setNote] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [showPfc, setShowPfc] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<MealAnalysisResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── バーコード（市販品の栄養取得） ───────────────────────────────────────────
  const [showBarcode, setShowBarcode] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [productLoading, setProductLoading] = useState(false);
  const [productResult, setProductResult] = useState<ProductLookupResult | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const [barcodeForRegister, setBarcodeForRegister] = useState<string | null>(null);

  // ── 食品検索（成分表）/ マイ食品 / 分量スライダー ─────────────────────────────
  const { myFoods, addMyFood, deleteMyFood } = useMyFoods();
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [foodQuery, setFoodQuery] = useState('');
  const [foodResults, setFoodResults] = useState<FoodCompositionItem[]>([]);
  const [showMyFoods, setShowMyFoods] = useState(false);
  const [basis, setBasis] = useState<NutritionBasis | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // 食事名入力からのサジェスト（料理DB＋マイ食品＋成分表を横断）
  const [nameSuggestions, setNameSuggestions] = useState<NameSuggestion[]>([]);
  const nameQueryRef = useRef('');
  const [estimatingName, setEstimatingName] = useState(false);

  // 複数料理ピッカーの対象テキスト（セット中はピッカーを表示）
  const [multiText, setMultiText] = useState<string | null>(null);

  // ── バリデーションエラー ──────────────────────────────────────────────────────
  const [nameError, setNameError] = useState('');
  const [calError, setCalError] = useState('');

  function reset() {
    setMode('quick');
    setName(''); setCalories(''); setDate(todayString()); setTime(nowTime());
    setCategory('朝食'); setNote('');
    setProtein(''); setFat(''); setCarbs('');
    setShowPfc(false); setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null); setAnalyzeResult(null);
    setShowBarcode(false); setBarcodeInput(''); setProductResult(null);
    setProductError(null); setProductLoading(false); setBarcodeForRegister(null);
    setShowFoodSearch(false); setFoodQuery(''); setFoodResults([]);
    setShowMyFoods(false); setBasis(null); setSavedMsg(null);
    setNameSuggestions([]); nameQueryRef.current = ''; setEstimatingName(false);
    setNameError(''); setCalError(''); setMultiText(null);
  }

  function handleClose() { reset(); onClose(); }

  // カメラ即解析から渡された初期値を補完する
  useEffect(() => {
    if (!open) return;
    if (initialPhotoFile) {
      setPhotoFile(initialPhotoFile);
      setPhotoPreview(URL.createObjectURL(initialPhotoFile));
      setMode('detail'); // 写真付きは詳細モードで開く
    }
    if (initialAnalysis) {
      // PFC データがある場合は詳細モードで開く（クイックモードには PFC フィールドがないため）
      if (initialAnalysis.protein !== null || initialAnalysis.fat !== null || initialAnalysis.carbs !== null) {
        setMode('detail');
      }
      setAnalyzeResult(initialAnalysis);
      if (initialAnalysis.estimatedCalories !== null) setCalories(String(initialAnalysis.estimatedCalories));
      if (initialAnalysis.dishName) setName(initialAnalysis.dishName);
      if (initialAnalysis.protein !== null) { setProtein(String(initialAnalysis.protein)); setShowPfc(true); }
      if (initialAnalysis.fat !== null) { setFat(String(initialAnalysis.fat)); setShowPfc(true); }
      if (initialAnalysis.carbs !== null) { setCarbs(String(initialAnalysis.carbs)); setShowPfc(true); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setAnalyzeResult(null);
  }

  // 栄養ソースを「基準量＋単位」として適用し、各入力欄へ反映する。
  function applyBasis(b: NutritionBasis) {
    setMultiText(null); // 単一ソース適用時は複数内訳をクリア
    setBasis(b);
    const v = scaleNutrition(b);
    setCalories(String(v.kcal)); setCalError('');
    if (v.p != null) setProtein(String(v.p));
    if (v.f != null) setFat(String(v.f));
    if (v.c != null) setCarbs(String(v.c));
    if (v.p != null || v.f != null || v.c != null) setShowPfc(true);
  }

  // 分量スライダー変更 → 栄養を再計算して反映。
  function updateQuantity(q: number) {
    if (!basis) return;
    const nb = { ...basis, quantity: q };
    setBasis(nb);
    const v = scaleNutrition(nb);
    setCalories(String(v.kcal));
    if (v.p != null) setProtein(String(v.p));
    if (v.f != null) setFat(String(v.f));
    if (v.c != null) setCarbs(String(v.c));
  }

  async function handleAnalyze() {
    if (!photoFile) return;
    setAnalyzing(true);
    try {
      const result = await analyzeMealPhotoCached(photoFile);
      setAnalyzeResult(result);
      const b = basisFromAnalysis(result);
      if (b) applyBasis(b);
      else if (result.estimatedCalories !== null) setCalories(String(result.estimatedCalories));
      if (result.dishName && !name.trim()) setName(result.dishName);
    } finally {
      setAnalyzing(false);
    }
  }

  async function lookupProduct(code: string) {
    const digits = code.replace(/\D/g, '');
    if (digits.length < 8) { setProductError('バーコードの桁数が正しくありません'); return; }
    setProductLoading(true);
    setProductError(null);
    setBarcodeForRegister(null);
    try {
      // 1) マイ食品（バーコード一致）を最優先
      const my = myFoods.find((f) => (f.barcode ?? '').replace(/\D/g, '') === digits);
      if (my) {
        setProductResult(null);
        setShowBarcode(false);
        setName(my.name); setNameError('');
        applyBasis(basisFromMyFood(my));
        setSavedMsg(`マイ食品「${my.name}」を反映しました`);
        return;
      }
      // 2) ローカルキャッシュ → 3) Open Food Facts
      const r = await lookupProductByBarcode(digits);
      if (!r.found) {
        setProductResult(null);
        setBarcodeForRegister(digits);
        setProductError('Open Food Facts に登録がありませんでした。手入力して「マイ食品に登録」すると次回から自動補完されます。');
        return;
      }
      setProductResult(r);
      setShowBarcode(false);
      if (r.name) { setName(r.name); setNameError(''); }
      const b = basisFromProduct(r);
      if (b) applyBasis(b);
    } finally {
      setProductLoading(false);
    }
  }

  function handleBarcodeResult(code: string) {
    setBarcodeInput(code);
    lookupProduct(code);
  }

  // ── 食品検索（成分表） ──────────────────────────────────────────────────────
  async function handleFoodQuery(q: string) {
    setFoodQuery(q);
    if (q.trim().length < 1) { setFoodResults([]); return; }
    setFoodResults(await searchFoods(q, 20));
  }

  function pickFood(item: FoodCompositionItem) {
    setName(item.name); setNameError('');
    applyBasis(basisFromFood(item));
    setShowFoodSearch(false); setFoodQuery(''); setFoodResults([]);
  }

  // ── マイ食品 ────────────────────────────────────────────────────────────────
  function registerMyFood() {
    if (!name.trim()) { setNameError('食事名を入力してください'); return; }
    const cal = parseInt(calories, 10);
    if (isNaN(cal) || cal < 0) { setCalError('カロリーを入力してください'); return; }

    const food = basis
      ? addMyFood({
          name: name.trim(),
          barcode: barcodeForRegister,
          basis: basis.unit,
          servingLabel: basis.unit === 'serving' ? basis.unitLabel : '100gあたり',
          calories: Math.round(basis.base.kcal),
          protein: basis.base.p, fat: basis.base.f, carbs: basis.base.c,
        })
      : addMyFood({
          name: name.trim(),
          barcode: barcodeForRegister,
          basis: 'serving',
          servingLabel: '1食',
          calories: cal,
          protein: parseNum(protein), fat: parseNum(fat), carbs: parseNum(carbs),
        });
    setSavedMsg(`「${food.name}」をマイ食品に登録しました`);
    setBarcodeForRegister(null); setProductError(null);
  }

  function pickMyFood(id: string) {
    const f = myFoods.find((m) => m.id === id);
    if (!f) return;
    setName(f.name); setNameError('');
    applyBasis(basisFromMyFood(f));
    setShowMyFoods(false);
  }

  // ── 食事名サジェスト（料理DB＋マイ食品＋成分表を横断） ────────────────────────
  function handleNameInput(v: string) {
    setName(v);
    if (v.trim()) setNameError('');
    setMultiText(null); // 入力変更で前回の内訳をクリア
    updateNameSuggestions(v);
  }

  async function updateNameSuggestions(q: string) {
    const query = q.trim();
    nameQueryRef.current = query;
    if (query.length < 1) { setNameSuggestions([]); return; }

    const seen = new Set<string>();
    const list: NameSuggestion[] = [];
    const push = (label: string, sub: string, b: NutritionBasis) => {
      if (seen.has(label) || list.length >= 8) return;
      seen.add(label); list.push({ key: label, label, sub, basis: b });
    };
    // 1) 料理DB（牛丼・麻婆豆腐など）
    for (const d of searchDishes(query, 5)) push(d.name, `${d.kcal}kcal / ${d.serving}`, basisFromDish(d));
    // 2) マイ食品（名前一致）
    for (const f of myFoods.filter((m) => m.name.includes(query)).slice(0, 4)) {
      push(f.name, `${f.calories}kcal · マイ食品`, basisFromMyFood(f));
    }
    setNameSuggestions([...list]); // 同期分を即時表示

    // 3) 成分表（非同期・古いクエリなら破棄）
    const foods = await searchFoods(query, 5);
    if (nameQueryRef.current !== query) return;
    for (const it of foods) push(it.name, `${it.kcal}kcal / 100g`, basisFromFood(it));
    setNameSuggestions([...list]);
  }

  function pickSuggestion(s: NameSuggestion) {
    setName(s.label); setNameError('');
    applyBasis(s.basis);
    setNameSuggestions([]);
    nameQueryRef.current = '';
  }

  // 料理名テキストから1品をAI推定（単一料理）。
  async function runAiEstimate() {
    const q = name.trim();
    if (q.length < 2) return;
    setEstimatingName(true);
    setSavedMsg(null);
    try {
      const result = await estimateMealByNameCached(q);
      const b = basisFromAnalysis(result);
      if (b) {
        applyBasis(b);
      } else {
        setSavedMsg('AIが推定できませんでした。手動で入力してください。');
      }
    } finally {
      setEstimatingName(false);
    }
  }

  // 複数料理ピッカーの合計を、保存用の calories/PFC/名前へ反映（合計を1件として保存）。
  const handleMultiChange = useCallback((t: MultiTotal) => {
    setBasis(null);
    setCalories(String(t.kcal)); setCalError('');
    setProtein(t.protein != null ? String(t.protein) : '');
    setFat(t.fat != null ? String(t.fat) : '');
    setCarbs(t.carbs != null ? String(t.carbs) : '');
    setShowPfc(t.protein != null || t.fat != null || t.carbs != null);
    setName(t.names.join('、'));
  }, []);

  function renderNameSuggestions() {
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

  function handleSave() {
    // インラインバリデーション
    let valid = true;
    if (!name.trim()) { setNameError('食事名を入力してください'); valid = false; } else setNameError('');
    const cal = parseInt(calories, 10);
    if (isNaN(cal) || cal < 0) { setCalError('0以上の数値を入力してください'); valid = false; } else setCalError('');
    if (!valid) return;

    const proteinVal = parseFloat(protein);
    const fatVal = parseFloat(fat);
    const carbsVal = parseFloat(carbs);
    onSave({
      name: name.trim(),
      calories: cal,
      time,
      category,
      date,
      note: note.trim() || undefined,
      photoFile,
      protein: !isNaN(proteinVal) && proteinVal >= 0 ? proteinVal : undefined,
      fat: !isNaN(fatVal) && fatVal >= 0 ? fatVal : undefined,
      carbs: !isNaN(carbsVal) && carbsVal >= 0 ? carbsVal : undefined,
    });
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="食事を追加">

      {/* ── モード切り替えタブ ── */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {(['quick', 'detail'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {m === 'quick' ? '⚡ クイック' : '✏️ 詳細'}
          </button>
        ))}
      </div>

      {/* ── クイックモード ── */}
      {mode === 'quick' && (
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
          {renderNameSuggestions()}
          {multiText && (
            <MultiDishPicker initialText={multiText} myFoods={myFoods} onChange={handleMultiChange} />
          )}

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
      )}

      {/* ── 詳細モード ── */}
      {mode === 'detail' && (
        <>
          {/* Photo */}
          <div className="mb-4">
            <label className="text-sm font-semibold text-gray-600 block mb-2">写真（任意）</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {photoPreview ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="preview"
                  className="w-full h-40 object-cover rounded-xl cursor-pointer"
                  onClick={() => fileRef.current?.click()}
                />
                <p className="text-xs text-gray-400 text-center">タップで変更</p>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full py-2.5 bg-[#4CAF50] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {analyzing ? <><span className="animate-spin">⏳</span> 解析中...</> : <>✨ 写真でカロリーを推定</>}
                </button>
                {analyzeResult && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">✅ 解析結果（参考値・自由に修正できます）</p>
                      {analyzeResult.source === 'db' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-green-600 text-white text-[10px] font-bold">
                          📋 成分表ベース
                        </span>
                      )}
                      {analyzeResult.source === 'ai' && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold border border-amber-300">
                          🤖 AI推定
                        </span>
                      )}
                    </div>
                    {analyzeResult.source === 'db' && analyzeResult.matchedFood && (
                      <p className="text-[11px] text-green-700">
                        「{analyzeResult.matchedFood}」の{analyzeResult.servingLabel ?? '標準量'}として栄養成分表から算出しました
                      </p>
                    )}
                    {analyzeResult.candidates && analyzeResult.candidates.length > 0 && (
                      <div>
                        <p className="text-[11px] text-green-700 mb-1.5">料理名の候補（タップで選択）</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analyzeResult.candidates.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => { setName(c); setNameError(''); }}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                                name === c
                                  ? 'bg-[#4CAF50] text-white border-[#4CAF50]'
                                  : 'bg-white text-green-800 border-green-300 hover:bg-green-100'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {analyzeResult.confidence !== null && (
                      <p>信頼度: {Math.round(analyzeResult.confidence * 100)}%</p>
                    )}
                    {analyzeResult.notes && <p>{analyzeResult.notes}</p>}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-[#4CAF50] hover:text-[#4CAF50] transition-colors"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm">写真を選択</span>
              </button>
            )}
          </div>

          {/* ── バーコード（市販品の栄養取得） ── */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => { setShowBarcode((v) => !v); setProductError(null); }}
              className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-[#4CAF50] hover:text-[#4CAF50] transition-colors flex items-center justify-center gap-2"
            >
              📦 バーコードで栄養を取得（市販品）
            </button>

            {showBarcode && (
              <div className="mt-3 space-y-3 bg-gray-50 rounded-xl p-3">
                <BarcodeScanner onResult={handleBarcodeResult} onClose={() => setShowBarcode(false)} />
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    inputMode="numeric"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="バーコード番号を手入力"
                    maxLength={14}
                  />
                  <button
                    type="button"
                    onClick={() => lookupProduct(barcodeInput)}
                    disabled={productLoading}
                    className="px-4 py-2 bg-[#4CAF50] text-white rounded-xl text-sm font-bold disabled:opacity-60 shrink-0"
                  >
                    {productLoading ? '…' : '検索'}
                  </button>
                </div>
              </div>
            )}

            {productLoading && !showBarcode && (
              <p className="text-xs text-gray-400 mt-2 text-center">商品情報を取得中…</p>
            )}
            {productError && <p className="text-xs text-amber-600 mt-2">{productError}</p>}
            {barcodeForRegister && (
              <button
                type="button"
                onClick={registerMyFood}
                className="mt-2 w-full py-2 bg-white border border-[#4CAF50] text-[#4CAF50] rounded-lg text-xs font-bold"
              >
                ＋ この商品をマイ食品に登録（バーコード {barcodeForRegister} を紐付け）
              </button>
            )}
            {productResult && productResult.found && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 flex gap-3 items-center">
                {productResult.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productResult.imageUrl}
                    alt={productResult.name ?? ''}
                    className="w-14 h-14 object-cover rounded-lg bg-white shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold truncate">{productResult.name ?? '商品'}</p>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-green-600 text-white text-[10px] font-bold">
                      📦 Open Food Facts
                    </span>
                  </div>
                  {productResult.brand && (
                    <p className="text-[11px] text-green-700 truncate">{productResult.brand}</p>
                  )}
                  <p className="text-[11px] text-green-700 mt-0.5">
                    {productResult.servingLabel}：{productResult.calories ?? '—'}kcal
                    {productResult.protein != null && ` / P${productResult.protein}`}
                    {productResult.fat != null && ` F${productResult.fat}`}
                    {productResult.carbs != null && ` C${productResult.carbs}`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── 食品検索（成分表） & マイ食品 ── */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setShowFoodSearch((v) => !v); setShowMyFoods(false); }}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                showFoodSearch ? 'border-[#4CAF50] text-[#4CAF50] bg-green-50' : 'border-gray-200 text-gray-500 hover:border-[#4CAF50] hover:text-[#4CAF50]'
              }`}
            >
              🔍 食品を検索
            </button>
            <button
              type="button"
              onClick={() => { setShowMyFoods((v) => !v); setShowFoodSearch(false); }}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                showMyFoods ? 'border-[#4CAF50] text-[#4CAF50] bg-green-50' : 'border-gray-200 text-gray-500 hover:border-[#4CAF50] hover:text-[#4CAF50]'
              }`}
            >
              ⭐ マイ食品{myFoods.length > 0 ? `(${myFoods.length})` : ''}
            </button>
          </div>

          {showFoodSearch && (
            <div className="mb-4 bg-gray-50 rounded-xl p-3 space-y-2">
              <input
                className="input"
                value={foodQuery}
                onChange={(e) => handleFoodQuery(e.target.value)}
                placeholder="例: 精白米、鶏卵、木綿豆腐、ヨーグルト"
                autoFocus
              />
              <p className="text-[10px] text-gray-400">
                日本食品標準成分表（八訂）。タップで100gあたりを反映し、下の「分量」で調整できます
              </p>
              <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                {foodResults.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => pickFood(item)}
                      className="w-full text-left py-2 px-1 hover:bg-white rounded flex justify-between gap-2 items-center"
                    >
                      <span className="text-xs text-gray-700 truncate">{item.name}</span>
                      <span className="text-[11px] text-gray-400 shrink-0">{item.kcal}kcal/100g</span>
                    </button>
                  </li>
                ))}
                {foodQuery.trim() && foodResults.length === 0 && (
                  <li className="text-xs text-gray-400 py-2">該当する食品が見つかりません</li>
                )}
              </ul>
            </div>
          )}

          {showMyFoods && (
            <div className="mb-4 bg-gray-50 rounded-xl p-3 space-y-2">
              {myFoods.length === 0 ? (
                <p className="text-xs text-gray-400">
                  まだマイ食品がありません。内容を入力して下の「登録」で追加できます。
                </p>
              ) : (
                <ul className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {myFoods.map((f) => (
                    <li key={f.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => pickMyFood(f.id)}
                        className="flex-1 text-left py-2 px-1 hover:bg-white rounded flex justify-between gap-2 items-center"
                      >
                        <span className="text-xs text-gray-700 truncate">{f.name}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">
                          {f.calories}kcal/{f.basis === '100g' ? '100g' : (f.servingLabel || '1食')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMyFood(f.id)}
                        className="text-gray-300 hover:text-red-400 px-1.5 text-sm shrink-0"
                        aria-label="削除"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={registerMyFood}
                className="w-full py-2 bg-white border border-[#4CAF50] text-[#4CAF50] rounded-lg text-xs font-bold"
              >
                ＋ 現在の内容をマイ食品に登録
              </button>
            </div>
          )}

          {savedMsg && <p className="text-xs text-green-600 mb-3">✅ {savedMsg}</p>}

          <Field label="食事名" error={nameError}>
            <input
              className={`input ${nameError ? 'border-red-400 focus:border-red-400' : ''}`}
              value={name}
              onChange={(e) => handleNameInput(e.target.value)}
              placeholder="例: サラダチキン・野菜スープ"
              maxLength={60}
            />
          </Field>
          {renderNameSuggestions()}
          {multiText && (
            <MultiDishPicker initialText={multiText} myFoods={myFoods} onChange={handleMultiChange} />
          )}

          {/* ── 分量スライダー（栄養ソース反映後に表示） ── */}
          {basis && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <p className="text-xs font-bold text-blue-800 truncate">⚖️ 分量：{basis.name}</p>
                <span className="shrink-0 text-[10px] font-bold text-blue-600">{ORIGIN_LABEL[basis.origin]}</span>
              </div>
              <input
                type="range"
                min={basis.unit === 'serving' ? 0.25 : 10}
                max={basis.unit === 'serving' ? 4 : 500}
                step={basis.unit === 'serving' ? 0.25 : 10}
                value={basis.quantity}
                onChange={(e) => updateQuantity(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex items-center justify-between text-[11px] text-blue-700 mt-1">
                <span>{basis.unit === 'serving' ? `${basis.quantity} ${basis.unitLabel}` : `${basis.quantity} g`}</span>
                <span className="font-bold">≈ {calories || 0} kcal</span>
              </div>
            </div>
          )}

          <Field label="カロリー（kcal）" error={calError}>
            <input
              className={`input ${calError ? 'border-red-400 focus:border-red-400' : ''}`}
              type="number"
              value={calories}
              onChange={(e) => { setCalories(e.target.value); setCalError(''); setBasis(null); setMultiText(null); }}
              placeholder="例: 380"
              min={0}
            />
          </Field>

          {/* 日付（過去日・未来日への変更対応） */}
          <Field label="日付">
            <input
              className="input"
              type="date"
              value={date}
              max={todayString()}
              onChange={(e) => setDate(e.target.value || todayString())}
            />
          </Field>

          <Field label="時刻">
            <input
              className="input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </Field>

          <Field label="区分">
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                    category === cat
                      ? 'bg-[#4CAF50] border-[#4CAF50] text-white'
                      : 'border-[#4CAF50] text-[#4CAF50] hover:bg-green-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </Field>

          {/* PFC toggle */}
          <button
            type="button"
            onClick={() => setShowPfc((v) => !v)}
            className="flex items-center justify-between w-full py-2 border-b border-gray-100 mb-3 text-sm font-semibold text-[#4CAF50]"
          >
            <span>栄養素 PFC（任意）</span>
            <span>{showPfc ? '▲' : '▼'}</span>
          </button>
          {showPfc && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: '🟦 タンパク質 (g)', val: protein, set: setProtein },
                { label: '🟨 脂質 (g)',       val: fat,     set: setFat     },
                { label: '🟩 炭水化物 (g)',   val: carbs,   set: setCarbs   },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-xs text-gray-400 block mb-1">{label}</label>
                  <input
                    className="input text-center px-2"
                    type="number"
                    value={val}
                    onChange={(e) => { set(e.target.value); setBasis(null); setMultiText(null); }}
                    placeholder="0"
                    min={0}
                  />
                </div>
              ))}
            </div>
          )}

          <Field label="メモ（任意）">
            <textarea
              className="input resize-none"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 外食・コンビニ など"
            />
          </Field>

          <button
            type="button"
            onClick={handleSave}
            className="w-full mt-4 py-3 bg-[#4CAF50] text-white font-bold rounded-xl text-sm hover:bg-[#43A047] transition-colors"
          >
            保存する
          </button>
        </>
      )}
    </Modal>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="mb-4">
      <label className="text-sm font-semibold text-gray-600 block mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
}
