'use client';

import { useState } from 'react';
import { useAppData } from '@/hooks/useAppData';
import {
  getRecentDayStats, getMealsByDate, todayString,
  sumProtein, sumFat, sumCarbs, calcStreak,
} from '@/lib/stats';

// Stats components
import WeeklyChart from '@/components/data/WeeklyChart';
import WeeklySummary from '@/components/data/WeeklySummary';
import PfcProgress from '@/components/data/PfcProgress';
import ExportButton from '@/components/data/ExportButton';

// Weight components
import WeightSummaryCard from '@/components/weight/WeightSummaryCard';
import WeightChart from '@/components/weight/WeightChart';
import WeightCard from '@/components/weight/WeightCard';
import AddWeightModal from '@/components/weight/AddWeightModal';

// Calendar components
import CalendarView from '@/components/calendar/CalendarView';
import DayDetailModal from '@/components/calendar/DayDetailModal';

import Modal from '@/components/ui/Modal';

type Segment = 'stats' | 'weight' | 'calendar';

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'stats',    label: '統計' },
  { id: 'weight',   label: '体重' },
  { id: 'calendar', label: 'カレンダー' },
];

const DEFAULT_TARGET_PROTEIN = 60;
const DEFAULT_TARGET_FAT = 60;
const DEFAULT_TARGET_CARBS = 260;

export default function DataPage() {
  const {
    meals, exercises, weights, settings,
    addWeight, deleteWeight, updateSettings, hydrated,
  } = useAppData();

  const [segment, setSegment] = useState<Segment>('stats');

  // ── Stats state ──────────────────────────────────────────────────────────────
  const weekStats = getRecentDayStats(meals, exercises, 7);
  const streak = calcStreak(meals, exercises);
  const today = todayString();
  const todayMeals = getMealsByDate(meals, today);
  const todayProtein = sumProtein(todayMeals);
  const todayFat = sumFat(todayMeals);
  const todayCarbs = sumCarbs(todayMeals);
  const hasTodayPfc = todayProtein > 0 || todayFat > 0 || todayCarbs > 0;
  const targetProtein = settings.targetProtein ?? DEFAULT_TARGET_PROTEIN;
  const targetFat = settings.targetFat ?? DEFAULT_TARGET_FAT;
  const targetCarbs = settings.targetCarbs ?? DEFAULT_TARGET_CARBS;

  const [showPfcModal, setShowPfcModal] = useState(false);
  const [pfcP, setPfcP] = useState(String(targetProtein));
  const [pfcF, setPfcF] = useState(String(targetFat));
  const [pfcC, setPfcC] = useState(String(targetCarbs));

  function openPfcModal() {
    setPfcP(String(targetProtein)); setPfcF(String(targetFat)); setPfcC(String(targetCarbs));
    setShowPfcModal(true);
  }
  function savePfc() {
    const p = parseInt(pfcP, 10), f = parseInt(pfcF, 10), c = parseInt(pfcC, 10);
    if ([p, f, c].some((v) => isNaN(v) || v <= 0)) { alert('各栄養素の目標値を正しく入力してください'); return; }
    updateSettings({ targetProtein: p, targetFat: f, targetCarbs: c });
    setShowPfcModal(false);
  }

  // ── Weight state ─────────────────────────────────────────────────────────────
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [showWeightSettings, setShowWeightSettings] = useState(false);
  const [targetStr, setTargetStr] = useState('');
  const [heightStr, setHeightStr] = useState('');

  function openWeightSettings() {
    setTargetStr(settings.targetWeightKg ? String(settings.targetWeightKg) : '');
    setHeightStr(settings.heightCm ? String(settings.heightCm) : '');
    setShowWeightSettings(true);
  }
  function saveWeightSettings() {
    const target = parseFloat(targetStr);
    const height = parseFloat(heightStr);
    if (targetStr && (isNaN(target) || target <= 0)) { alert('目標体重を正しく入力してください'); return; }
    if (heightStr && (isNaN(height) || height < 50 || height > 250)) { alert('身長を正しく入力してください'); return; }
    updateSettings({ targetWeightKg: targetStr ? target : undefined, heightCm: heightStr ? height : undefined });
    setShowWeightSettings(false);
  }
  const sortedWeights = [...weights].sort((a, b) => b.date.localeCompare(a.date));

  // ── Calendar state ────────────────────────────────────────────────────────────
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function prevMonth() { if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1); }
  function nextMonth() { if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1); }

  const inputClass = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4CAF50] bg-white';

  if (!hydrated) {
    return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">読み込み中...</div>;
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-black text-gray-900 tracking-tight mb-4">データ</h1>

      {/* ── Segment control ── */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSegment(s.id)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              segment === s.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Stats ── */}
      {segment === 'stats' && (
        <>
          <WeeklyChart data={weekStats} />
          <WeeklySummary stats={weekStats} streak={streak} />
          <PfcProgress
            todayProtein={todayProtein} todayFat={todayFat} todayCarbs={todayCarbs}
            targetProtein={targetProtein} targetFat={targetFat} targetCarbs={targetCarbs}
            hasTodayPfc={hasTodayPfc} onEdit={openPfcModal}
          />
          <ExportButton meals={meals} exercises={exercises} />

          <Modal open={showPfcModal} onClose={() => setShowPfcModal(false)} title="1日のPFC目標を設定">
            <div className="space-y-4">
              {[
                { label: '🟦 タンパク質（g）', val: pfcP, set: setPfcP },
                { label: '🟨 脂質（g）',       val: pfcF, set: setPfcF },
                { label: '🟩 炭水化物（g）',   val: pfcC, set: setPfcC },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-sm font-semibold text-gray-600 block mb-1.5">{label}</label>
                  <input className={inputClass} type="number" value={val} onChange={(e) => set(e.target.value)} min={1} />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPfcModal(false)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">キャンセル</button>
                <button type="button" onClick={savePfc} className="flex-1 py-3 bg-[#4CAF50] text-white text-sm font-semibold rounded-xl hover:bg-[#43A047]">保存する</button>
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* ── Weight ── */}
      {segment === 'weight' && (
        <>
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={openWeightSettings} className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">⚙️ 設定</button>
            <button type="button" onClick={() => setShowAddWeight(true)} className="px-4 py-2 bg-[#42A5F5] text-white text-sm font-semibold rounded-xl hover:bg-[#1E88E5] ml-auto">＋ 記録</button>
          </div>
          <WeightSummaryCard weights={weights} settings={settings} />
          <WeightChart weights={weights} settings={settings} />
          <h2 className="text-sm font-bold text-gray-700 mb-2">記録履歴</h2>
          <div className="space-y-3">
            {sortedWeights.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">⚖️</p>
                <p className="text-sm font-medium">体重記録はありません</p>
              </div>
            ) : (
              sortedWeights.map((entry, i) => (
                <WeightCard key={entry.id} entry={entry} prevWeight={sortedWeights[i + 1]?.weightKg} onDelete={deleteWeight} />
              ))
            )}
          </div>

          <AddWeightModal open={showAddWeight} onClose={() => setShowAddWeight(false)} onSave={(data) => addWeight(data)} />

          <Modal open={showWeightSettings} onClose={() => setShowWeightSettings(false)} title="体重の設定">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-1.5">目標体重（kg）</label>
                <input className={inputClass} type="number" step="0.1" min={1} placeholder="例: 60.0" value={targetStr} onChange={(e) => setTargetStr(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-1.5">身長（cm）— BMI計算に使用</label>
                <input className={inputClass} type="number" step="0.1" min={50} max={250} placeholder="例: 170" value={heightStr} onChange={(e) => setHeightStr(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowWeightSettings(false)} className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">キャンセル</button>
                <button type="button" onClick={saveWeightSettings} className="flex-1 py-3 bg-[#42A5F5] text-white text-sm font-semibold rounded-xl hover:bg-[#1E88E5]">保存する</button>
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* ── Calendar ── */}
      {segment === 'calendar' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:bg-gray-50 text-lg">‹</button>
            <span className="text-base font-bold text-gray-700">{year}年 {month}月</span>
            <button type="button" onClick={nextMonth} className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm text-gray-600 hover:bg-gray-50 text-lg">›</button>
          </div>

          <CalendarView meals={meals} exercises={exercises} year={year} month={month} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

          <div className="flex items-center gap-4 mt-3 px-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4CAF50]" />
              <span className="text-xs text-gray-400">食（摂取kcal）</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF7043]" />
              <span className="text-xs text-gray-400">消（消費kcal）</span>
            </div>
          </div>

          {selectedDate && (
            <DayDetailModal open={true} onClose={() => setSelectedDate(null)} date={selectedDate} meals={meals} exercises={exercises} />
          )}
        </>
      )}
    </main>
  );
}
