'use client';

import { useState, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import { MealCategory, MealEntry, MealAnalysisResult } from '@/lib/types';
import { todayString } from '@/lib/stats';
import { analyzeWithGemini } from '@/lib/gemini';

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<MealEntry, 'id'>) => void;
};

const CATEGORIES: MealCategory[] = ['朝食', '昼食', '夕食', '間食'];

function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function AddMealModal({ open, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
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

  const hasGemini = !!process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  function reset() {
    setName(''); setCalories(''); setTime(nowTime());
    setCategory('朝食'); setNote('');
    setProtein(''); setFat(''); setCarbs('');
    setShowPfc(false); setPhotoFile(null);
    setPhotoPreview(null); setAnalyzeResult(null);
  }

  function handleClose() { reset(); onClose(); }

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

  function handleSave() {
    if (!name.trim()) { alert('食事名を入力してください'); return; }
    const cal = parseInt(calories, 10);
    if (isNaN(cal) || cal < 0) { alert('カロリーを正しく入力してください'); return; }
    const proteinVal = parseFloat(protein);
    const fatVal = parseFloat(fat);
    const carbsVal = parseFloat(carbs);
    onSave({
      name: name.trim(),
      calories: cal,
      time,
      category,
      date: todayString(),
      note: note.trim() || undefined,
      photoUri: photoPreview ?? undefined,
      protein: !isNaN(proteinVal) && proteinVal >= 0 ? proteinVal : undefined,
      fat: !isNaN(fatVal) && fatVal >= 0 ? fatVal : undefined,
      carbs: !isNaN(carbsVal) && carbsVal >= 0 ? carbsVal : undefined,
    });
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="食事を追加">
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
            {hasGemini && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full py-2.5 bg-[#4CAF50] text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {analyzing ? (
                  <><span className="animate-spin">⏳</span> 解析中...</>
                ) : (
                  <>✨ 写真でカロリーを推定</>
                )}
              </button>
            )}
            {analyzeResult && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800 space-y-1">
                <p className="font-semibold">✅ 解析結果（参考値・自由に修正できます）</p>
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

      <Field label="食事名">
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: サラダチキン・野菜スープ"
          maxLength={60}
        />
      </Field>

      <Field label="カロリー（kcal）">
        <input
          className="input"
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          placeholder="例: 380"
          min={0}
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
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="text-sm font-semibold text-gray-600 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
