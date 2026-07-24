'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  MealCategory, MealEntry, MealAnalysisResult, ProductLookupResult,
  FoodCompositionItem, NutritionBasis,
} from '@/lib/types';
import { todayString } from '@/lib/stats';
import { analyzeMealPhotoCached, estimateMealByNameCached, searchAiCache } from '@/lib/aiNutrition';
import { normalizeImagePhoto } from '@/lib/imageOrientation';
import { type MultiTotal } from '@/components/meal/MultiDishPicker';
import { lookupProductByBarcode } from '@/lib/openFoodFacts';
import { searchFoods } from '@/lib/foodComposition';
import { searchDishes } from '@/lib/nutritionDb';
import { guessMealCategory } from '@/lib/recipe';
import {
  scaleNutrition, basisFromAnalysis, basisFromProduct, basisFromFood, basisFromMyFood, basisFromDish,
  basisFromAiCache,
} from '@/lib/portion';
import { useMyFoods } from '@/hooks/useMyFoods';

export type NameSuggestion = {
  key: string; label: string; sub: string; basis: NutritionBasis;
  // AIキャッシュに現在の入力テキストと完全一致するキーがあるか（AI推定ボタンを隠す判定に使う）
  exactAiKey?: boolean;
};

/** マッチング用の正規化（nutritionDb/aiNutrition と同方針）。 */
function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[\s　・、,，.．。!！?？]/g, '').trim();
}

export const CATEGORIES: MealCategory[] = ['朝食', '昼食', '夕食', '間食'];

export function parseNum(s: string): number | null {
  const v = parseFloat(s);
  return !isNaN(v) && v >= 0 ? v : null;
}

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function hourFromTime(t: string): number {
  return parseInt(t.slice(0, 2), 10);
}

type SavedMealData = Omit<MealEntry, 'id' | 'photoUri' | 'photoId'> & { photoFile?: File | null };

type Params = {
  open: boolean;
  onClose: () => void;
  onSave: (data: SavedMealData) => void;
  initialPhotoFile?: File | null;
  initialAnalysis?: MealAnalysisResult | null;
};

/**
 * 食事追加フォームの状態とロジックをまとめたコントローラフック。
 * AddMealModal / QuickMealForm / DetailMealForm から共有される（値は同一インスタンス）。
 */
export function useMealForm({ open, onClose, onSave, initialPhotoFile, initialAnalysis }: Params) {
  // ── フォーム状態 ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [date, setDate] = useState(todayString);
  const [time, setTimeRaw] = useState(nowTime);
  const [category, setCategoryRaw] = useState<MealCategory>(() => guessMealCategory(new Date().getHours()));
  // カテゴリがまだ時刻追従モードか（区分タブをユーザーが手動選択したら false になり、以後は時刻変更で上書きしない）
  const categoryAutoRef = useRef(true);
  const [note, setNote] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [showPfc, setShowPfc] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]); // 一緒に食べたフレンド
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

  // 時刻入力: 値を更新し、区分がまだ時刻追従モードなら記録時刻から自動で選び直す
  function setTime(v: string) {
    setTimeRaw(v);
    if (categoryAutoRef.current) setCategoryRaw(guessMealCategory(hourFromTime(v)));
  }

  // 区分タブ: ユーザーが手動選択したら以後は時刻変更で上書きしない
  function setCategory(cat: MealCategory) {
    categoryAutoRef.current = false;
    setCategoryRaw(cat);
  }

  const reset = useCallback(() => {
    const t = nowTime();
    setName(''); setCalories(''); setDate(todayString()); setTimeRaw(t);
    categoryAutoRef.current = true;
    setCategoryRaw(guessMealCategory(hourFromTime(t)));
    setNote('');
    setProtein(''); setFat(''); setCarbs('');
    setShowPfc(false); setPhotoFile(null); setTaggedUserIds([]);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null); setAnalyzeResult(null);
    setShowBarcode(false); setBarcodeInput(''); setProductResult(null);
    setProductError(null); setProductLoading(false); setBarcodeForRegister(null);
    setShowFoodSearch(false); setFoodQuery(''); setFoodResults([]);
    setShowMyFoods(false); setBasis(null); setSavedMsg(null);
    setNameSuggestions([]); nameQueryRef.current = ''; setEstimatingName(false);
    setNameError(''); setCalError(''); setMultiText(null);
  }, [photoPreview]);

  function handleClose() { reset(); onClose(); }

  // モーダルを開くたびに記録時刻を「今」に合わせ、区分もそれに応じて自動推定し直す
  // （カメラ即解析から渡された初期値があればそれで上書き補完する）
  useEffect(() => {
    if (!open) return;
    const t = nowTime();
    setTimeRaw(t);
    categoryAutoRef.current = true;
    setCategoryRaw(guessMealCategory(hourFromTime(t)));

    if (initialPhotoFile) {
      setPhotoFile(initialPhotoFile);
      setPhotoPreview(URL.createObjectURL(initialPhotoFile));
    }
    if (initialAnalysis) {
      setAnalyzeResult(initialAnalysis);
      if (initialAnalysis.estimatedCalories !== null) setCalories(String(initialAnalysis.estimatedCalories));
      if (initialAnalysis.dishName) setName(initialAnalysis.dishName);
      if (initialAnalysis.protein !== null) { setProtein(String(initialAnalysis.protein)); setShowPfc(true); }
      if (initialAnalysis.fat !== null) { setFat(String(initialAnalysis.fat)); setShowPfc(true); }
      if (initialAnalysis.carbs !== null) { setCarbs(String(initialAnalysis.carbs)); setShowPfc(true); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    // 横向き撮影などのEXIF回転をピクセルへ焼き込んでからAI解析・保存に使う
    const file = await normalizeImagePhoto(raw);
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
    const push = (label: string, sub: string, b: NutritionBasis, exactAiKey?: boolean) => {
      if (seen.has(label) || list.length >= 8) return;
      seen.add(label); list.push({ key: label, label, sub, basis: b, exactAiKey });
    };
    // 1) 料理DB（牛丼・麻婆豆腐など）
    for (const d of searchDishes(query, 5)) push(d.name, `${d.kcal}kcal / ${d.serving}`, basisFromDish(d));
    // 2) マイ食品（名前一致）
    for (const f of myFoods.filter((m) => m.name.includes(query)).slice(0, 4)) {
      push(f.name, `${f.calories}kcal · マイ食品`, basisFromMyFood(f));
    }
    setNameSuggestions([...list]); // 同期分を即時表示

    // 3) 成分表 ＋ AI推定キャッシュ（過去にAI推定済みの料理）を横断（非同期・古いクエリなら破棄）
    const queryKey = normalizeKey(query);
    const [foods, aiItems] = await Promise.all([searchFoods(query, 5), searchAiCache(query, 5)]);
    if (nameQueryRef.current !== query) return;
    for (const it of foods) push(it.name, `${it.kcal}kcal / 100g`, basisFromFood(it));
    for (const a of aiItems) {
      push(a.name, `${a.kcal}kcal・AI推定済み`, basisFromAiCache(a), a.nameKey === queryKey);
    }
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
      taggedUserIds: taggedUserIds.length > 0 ? taggedUserIds : undefined,
    });
    reset();
    onClose();
  }

  return {
    // state
    name, calories, date, time, category, note, protein, fat, carbs,
    showPfc, photoPreview, analyzing, analyzeResult, fileRef, taggedUserIds, setTaggedUserIds,
    showBarcode, barcodeInput, productLoading, productResult, productError, barcodeForRegister,
    myFoods, showFoodSearch, foodQuery, foodResults, showMyFoods, basis, savedMsg,
    nameSuggestions, estimatingName, multiText, nameError, calError,
    // setters (JSX で直接使うもの)
    setName, setNameError, setCalories, setCalError, setDate, setTime, setCategory, setNote,
    setProtein, setFat, setCarbs, setShowPfc, setShowBarcode, setBarcodeInput, setProductError,
    setShowFoodSearch, setShowMyFoods, setBasis, setMultiText,
    // handlers
    reset, handleClose, handlePhotoChange, handleAnalyze, lookupProduct, handleBarcodeResult,
    handleFoodQuery, pickFood, registerMyFood, pickMyFood, handleNameInput, pickSuggestion,
    runAiEstimate, handleMultiChange, updateQuantity, handleSave, deleteMyFood,
  };
}

export type MealForm = ReturnType<typeof useMealForm>;

/** タグ付け候補のフレンド（食事フォームに渡す最小情報） */
export type TagFriend = { id: string; name: string; avatarUrl?: string | null };
