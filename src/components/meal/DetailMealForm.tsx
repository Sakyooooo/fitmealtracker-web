'use client';

import dynamic from 'next/dynamic';
import { type MealForm, CATEGORIES } from './useMealForm';
import { Field, NameSuggestions, MultiPickerSlot, ORIGIN_LABEL } from './mealFormParts';

const BarcodeScanner = dynamic(() => import('@/components/meal/BarcodeScanner'), { ssr: false });

/** 詳細モード: 写真解析・バーコード・食品検索・マイ食品・分量・日時・PFC・メモ。 */
export default function DetailMealForm({ form }: { form: MealForm }) {
  return (
    <>
      <PhotoPanel form={form} />
      <BarcodePanel form={form} />
      <FoodSourcePanel form={form} />

      {form.savedMsg && <p className="text-xs text-green-600 mb-3">✅ {form.savedMsg}</p>}

      <Field label="食事名" error={form.nameError}>
        <input
          className={`input ${form.nameError ? 'border-red-400 focus:border-red-400' : ''}`}
          value={form.name}
          onChange={(e) => form.handleNameInput(e.target.value)}
          placeholder="例: サラダチキン・野菜スープ"
          maxLength={60}
        />
      </Field>
      <NameSuggestions form={form} />
      <MultiPickerSlot form={form} />

      <PortionSlider form={form} />

      <Field label="カロリー（kcal）" error={form.calError}>
        <input
          className={`input ${form.calError ? 'border-red-400 focus:border-red-400' : ''}`}
          type="number"
          value={form.calories}
          onChange={(e) => { form.setCalories(e.target.value); form.setCalError(''); form.setBasis(null); form.setMultiText(null); }}
          placeholder="例: 380"
          min={0}
        />
      </Field>

      <Field label="日付">
        <input
          className="input"
          type="date"
          value={form.date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => form.setDate(e.target.value || new Date().toISOString().slice(0, 10))}
        />
      </Field>

      <Field label="時刻">
        <input className="input" type="time" value={form.time} onChange={(e) => form.setTime(e.target.value)} />
      </Field>

      <Field label="区分">
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => form.setCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                form.category === cat
                  ? 'bg-[#4CAF50] border-[#4CAF50] text-white'
                  : 'border-[#4CAF50] text-[#4CAF50] hover:bg-green-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </Field>

      <PfcPanel form={form} />

      <Field label="メモ（任意）">
        <textarea
          className="input resize-none"
          rows={2}
          value={form.note}
          onChange={(e) => form.setNote(e.target.value)}
          placeholder="例: 外食・コンビニ など"
        />
      </Field>

      <button
        type="button"
        onClick={form.handleSave}
        className="w-full mt-4 py-3 bg-[#4CAF50] text-white font-bold rounded-xl text-sm hover:bg-[#43A047] transition-colors"
      >
        保存する
      </button>
    </>
  );
}

// ── 写真＋AI解析 ──────────────────────────────────────────────────────────────
function PhotoPanel({ form }: { form: MealForm }) {
  const { photoPreview, fileRef, handlePhotoChange, handleAnalyze, analyzing, analyzeResult, name, setName, setNameError } = form;
  return (
    <div className="mb-4">
      <label className="text-sm font-semibold text-gray-600 block mb-2">写真（任意）</label>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
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
              {analyzeResult.confidence !== null && <p>信頼度: {Math.round(analyzeResult.confidence * 100)}%</p>}
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
  );
}

// ── バーコード（市販品の栄養取得） ────────────────────────────────────────────
function BarcodePanel({ form }: { form: MealForm }) {
  const {
    showBarcode, setShowBarcode, setProductError, handleBarcodeResult, barcodeInput, setBarcodeInput,
    lookupProduct, productLoading, productError, barcodeForRegister, registerMyFood, productResult,
  } = form;
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => { setShowBarcode(!showBarcode); setProductError(null); }}
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

      {productLoading && !showBarcode && <p className="text-xs text-gray-400 mt-2 text-center">商品情報を取得中…</p>}
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
            <img src={productResult.imageUrl} alt={productResult.name ?? ''} className="w-14 h-14 object-cover rounded-lg bg-white shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold truncate">{productResult.name ?? '商品'}</p>
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-green-600 text-white text-[10px] font-bold">
                📦 Open Food Facts
              </span>
            </div>
            {productResult.brand && <p className="text-[11px] text-green-700 truncate">{productResult.brand}</p>}
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
  );
}

// ── 食品検索（成分表）＋ マイ食品 ─────────────────────────────────────────────
function FoodSourcePanel({ form }: { form: MealForm }) {
  const {
    showFoodSearch, setShowFoodSearch, showMyFoods, setShowMyFoods, myFoods,
    foodQuery, handleFoodQuery, foodResults, pickFood, pickMyFood, deleteMyFood, registerMyFood,
  } = form;
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { setShowFoodSearch(!showFoodSearch); setShowMyFoods(false); }}
          className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
            showFoodSearch ? 'border-[#4CAF50] text-[#4CAF50] bg-green-50' : 'border-gray-200 text-gray-500 hover:border-[#4CAF50] hover:text-[#4CAF50]'
          }`}
        >
          🔍 食品を検索
        </button>
        <button
          type="button"
          onClick={() => { setShowMyFoods(!showMyFoods); setShowFoodSearch(false); }}
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
    </>
  );
}

// ── 分量スライダー ────────────────────────────────────────────────────────────
function PortionSlider({ form }: { form: MealForm }) {
  const { basis, updateQuantity, calories } = form;
  if (!basis) return null;
  return (
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
  );
}

// ── PFC（任意・折りたたみ） ───────────────────────────────────────────────────
function PfcPanel({ form }: { form: MealForm }) {
  const { showPfc, setShowPfc, protein, setProtein, fat, setFat, carbs, setCarbs, setBasis, setMultiText } = form;
  return (
    <>
      <button
        type="button"
        onClick={() => setShowPfc(!showPfc)}
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
    </>
  );
}
