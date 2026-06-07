'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal';
import { MealCategory, MealEntry, MealAnalysisResult, ProductLookupResult } from '@/lib/types';
import { todayString } from '@/lib/stats';
import { analyzeWithGemini } from '@/lib/gemini';
import { lookupProductByBarcode } from '@/lib/openFoodFacts';

const BarcodeScanner = dynamic(() => import('@/components/meal/BarcodeScanner'), { ssr: false });

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
    setProductError(null); setProductLoading(false);
    setNameError(''); setCalError('');
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

  async function handleAnalyze() {
    if (!photoFile) return;
    setAnalyzing(true);
    try {
      const result = await analyzeWithGemini(photoFile);
      setAnalyzeResult(result);
      if (result.estimatedCalories !== null) setCalories(String(result.estimatedCalories));
      if (result.dishName && !name.trim()) setName(result.dishName);
      if (result.protein !== null) { setProtein(String(result.protein)); setShowPfc(true); }
      if (result.fat !== null) { setFat(String(result.fat)); setShowPfc(true); }
      if (result.carbs !== null) { setCarbs(String(result.carbs)); setShowPfc(true); }
    } finally {
      setAnalyzing(false);
    }
  }

  async function lookupProduct(code: string) {
    const digits = code.replace(/\D/g, '');
    if (digits.length < 8) { setProductError('バーコードの桁数が正しくありません'); return; }
    setProductLoading(true);
    setProductError(null);
    try {
      const r = await lookupProductByBarcode(digits);
      if (!r.found) {
        setProductResult(null);
        setProductError('Open Food Facts に登録がありませんでした。手動で入力してください。');
        return;
      }
      setProductResult(r);
      setShowBarcode(false);
      if (r.name) setName(r.name);
      if (r.calories != null) setCalories(String(r.calories));
      if (r.protein != null) { setProtein(String(r.protein)); setShowPfc(true); }
      if (r.fat != null) { setFat(String(r.fat)); setShowPfc(true); }
      if (r.carbs != null) { setCarbs(String(r.carbs)); setShowPfc(true); }
    } finally {
      setProductLoading(false);
    }
  }

  function handleBarcodeResult(code: string) {
    setBarcodeInput(code);
    lookupProduct(code);
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
              onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(''); }}
              placeholder="例: サラダチキン・牛丼"
              maxLength={60}
              autoFocus
            />
          </Field>

          <Field label="カロリー（kcal）" error={calError}>
            <input
              className={`input ${calError ? 'border-red-400 focus:border-red-400' : ''}`}
              type="number"
              value={calories}
              onChange={(e) => { setCalories(e.target.value); setCalError(''); }}
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

          <Field label="食事名" error={nameError}>
            <input
              className={`input ${nameError ? 'border-red-400 focus:border-red-400' : ''}`}
              value={name}
              onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameError(''); }}
              placeholder="例: サラダチキン・野菜スープ"
              maxLength={60}
            />
          </Field>

          <Field label="カロリー（kcal）" error={calError}>
            <input
              className={`input ${calError ? 'border-red-400 focus:border-red-400' : ''}`}
              type="number"
              value={calories}
              onChange={(e) => { setCalories(e.target.value); setCalError(''); }}
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
                    onChange={(e) => set(e.target.value)}
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
