'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMealData } from '@/hooks/useMealData';
import { useExerciseData } from '@/hooks/useExerciseData';
import { useWeightData } from '@/hooks/useWeightData';
import { useSettings } from '@/hooks/useSettings';
import { useFriends } from '@/hooks/useFriends';
import { loadSettings } from '@/lib/localRepository';
import { fileToSquareDataUrl } from '@/lib/imageResize';
import { updateAvatar } from '@/lib/identity';
import {
  getRecentDayStats, getMealsByDate, todayString,
  sumProtein, sumFat, sumCarbs, calcStreak,
} from '@/lib/stats';
import NicknameModal from '@/components/friends/NicknameModal';
import WeeklyChart from '@/components/data/WeeklyChart';
import WeeklySummary from '@/components/data/WeeklySummary';
import PfcProgress from '@/components/data/PfcProgress';
import ExportButton from '@/components/data/ExportButton';
import WeightSummaryCard from '@/components/weight/WeightSummaryCard';
import WeightChart from '@/components/weight/WeightChart';
import WeightCard from '@/components/weight/WeightCard';
import AddWeightModal from '@/components/weight/AddWeightModal';
import CalendarView from '@/components/calendar/CalendarView';
import DayDetailModal from '@/components/calendar/DayDetailModal';
import AccountLinkCard from '@/components/profile/AccountLinkCard';
import Modal from '@/components/ui/Modal';

const ACCENT = '#AB47BC';

const DEFAULT_TARGET_PROTEIN = 60;
const DEFAULT_TARGET_FAT = 60;
const DEFAULT_TARGET_CARBS = 260;

type Seg = 'calendar' | 'overview' | 'stats' | 'weight';
const SEGMENTS: { id: Seg; label: string }[] = [
  { id: 'calendar', label: 'カレンダー' },
  { id: 'overview', label: '概要' },
  { id: 'stats',    label: '統計' },
  { id: 'weight',   label: '体重' },
];

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const searchParams = useSearchParams();
  const { userId, friendCode, displayName, updateNickname } = useFriends();

  const { meals, deleteMeal } = useMealData();
  const { exercises, deleteExercise } = useExerciseData();
  const { weights, addWeight, deleteWeight } = useWeightData();
  const { settings, updateSettings } = useSettings();

  const tabParam = searchParams.get('tab');
  const [seg, setSeg] = useState<Seg>(
    tabParam === 'weight' ? 'weight'
      : tabParam === 'stats' ? 'stats'
      : tabParam === 'overview' ? 'overview'
      : 'calendar',
  );

  // ── identity (avatar / location) ──────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [location, setLocation] = useState('');
  const [showNickname, setShowNickname] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = loadSettings();
    setAvatarUrl(s.avatarUrl);
    setLocation(s.location ?? '');
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('画像ファイルを選択してください。'); return; }
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      updateSettings({ avatarUrl: dataUrl });
      setAvatarUrl(dataUrl);
      if (userId) updateAvatar(userId, dataUrl).catch(() => {});
    } catch {
      alert('画像の処理に失敗しました。');
    }
  }

  function removeAvatar() {
    updateSettings({ avatarUrl: undefined });
    setAvatarUrl(undefined);
    if (userId) updateAvatar(userId, null).catch(() => {});
  }

  function saveLocation() {
    updateSettings({ location: location.trim() || undefined });
  }

  async function handleCopy() {
    if (!friendCode) return;
    try { await navigator.clipboard.writeText(friendCode); }
    catch {
      const el = document.createElement('input');
      el.value = friendCode;
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  // ── stats ──────────────────────────────────────────────────────────────────────
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

  // ── This Month ──────────────────────────────────────────────────────────────────
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthMeals = meals.filter((m) => m.date.startsWith(ym));
  const monthEx = exercises.filter((e) => e.date.startsWith(ym));
  const monthBurned = monthEx.reduce((s, e) => s + e.caloriesBurned, 0);
  const monthIntake = monthMeals.reduce((s, m) => s + m.calories, 0);
  const sortedWeights = [...weights].sort((a, b) => b.date.localeCompare(a.date));
  const latestWeight = sortedWeights[0]?.weightKg ?? null;

  // ── calendar ────────────────────────────────────────────────────────────────────
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  function prevMonth() { if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1); }
  function nextMonth() { if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1); }

  // ── PFC target modal ────────────────────────────────────────────────────────────
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

  // ── Weight modals ───────────────────────────────────────────────────────────────
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

  const inputClass = 'w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4CAF50] bg-white';
  const name = displayName ?? friendCode ?? 'You';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative min-h-screen bg-white">
      {/* ── コンパクトな identity ストリップ ── */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <div className="relative flex-shrink-0">
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-md overflow-hidden"
            style={{ background: ACCENT }}
            aria-label="プロフィール画像を変更">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="プロフィール画像" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-black text-white">{initial}</span>
            )}
          </button>
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center border border-gray-100">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </span>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
        </div>

        <div className="flex-1 min-w-0">
          <button type="button" onClick={() => setShowNickname(true)} className="flex items-center gap-1.5 max-w-full">
            <span className="text-lg font-black text-gray-900 truncate">
              {displayName ?? <span className="text-gray-400 text-base font-bold">ニックネームを設定</span>}
            </span>
            <svg width="13" height="13" className="flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button type="button" onClick={handleCopy} className="flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: ACCENT }} />
            <span className="text-[11px] font-black tracking-widest" style={{ color: ACCENT }}>
              {copied ? 'コピー済み ✓' : friendCode ?? '—'}
            </span>
          </button>
        </div>
      </div>

      {/* ── セグメント切り替え ── */}
      <div className="px-4 mb-3">
        <div className="flex bg-gray-100 rounded-xl p-1">
          {SEGMENTS.map((s) => (
            <button key={s.id} type="button" onClick={() => setSeg(s.id)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                seg === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6">
        {/* ── カレンダー ── */}
        {seg === 'calendar' && (
          <>
            <div className="flex items-center justify-between mb-3">
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
            <p className="text-[11px] text-gray-400 text-center mt-2">日付をタップすると、その日の食事・運動の詳細を確認できます</p>
          </>
        )}

        {/* ── 概要 ── */}
        {seg === 'overview' && (
          <>
            {/* 地域（地球儀のラベルに表示） */}
            <div className="flex items-center gap-1.5 mb-4 px-3 py-2 rounded-xl bg-gray-50">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <input
                type="text" placeholder="地域を入力（例: 東京・日本）" maxLength={24}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={saveLocation}
                className="bg-transparent text-xs font-bold text-gray-700 focus:outline-none placeholder:text-gray-300 flex-1"
              />
              {avatarUrl && (
                <button type="button" onClick={removeAvatar} className="text-[11px] font-bold text-gray-400 hover:text-gray-600 flex-shrink-0">
                  画像を削除
                </button>
              )}
            </div>

            <p className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2">This Month</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <StatCard label="消費カロリー" value={monthBurned} unit="kcal" accent="#FF7043" />
              <StatCard label="摂取カロリー" value={monthIntake} unit="kcal" accent="#4CAF50" />
              <StatCard label="運動の記録" value={monthEx.length} unit="件" accent="#FF7043" />
              <StatCard label="食事の記録" value={monthMeals.length} unit="件" accent="#4CAF50" />
            </div>

            <p className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2">Goals</p>
            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <InfoRow label="現在の体重" value={latestWeight != null ? `${latestWeight} kg` : '未記録'} />
              <InfoRow label="目標体重" value={settings.targetWeightKg != null ? `${settings.targetWeightKg} kg` : '未設定'} />
              <InfoRow label="目標摂取カロリー" value={settings.targetIntakeCalories != null ? `${settings.targetIntakeCalories} kcal` : '未設定'} last />
            </div>

            <div className="mt-5">
              <AccountLinkCard />
            </div>
          </>
        )}

        {/* ── 統計 ── */}
        {seg === 'stats' && (
          <>
            <WeeklyChart data={weekStats} />
            <WeeklySummary stats={weekStats} streak={streak} />
            <PfcProgress
              todayProtein={todayProtein} todayFat={todayFat} todayCarbs={todayCarbs}
              targetProtein={targetProtein} targetFat={targetFat} targetCarbs={targetCarbs}
              hasTodayPfc={hasTodayPfc} onEdit={openPfcModal}
            />
            <ExportButton meals={meals} exercises={exercises} weights={weights} />
          </>
        )}

        {/* ── 体重 ── */}
        {seg === 'weight' && (
          <>
            <div className="flex gap-2 mb-4">
              <button type="button" onClick={openWeightSettings} className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50">⚙️ 設定</button>
              <button type="button" onClick={() => setShowAddWeight(true)} className="px-4 py-2 bg-[#42A5F5] text-white text-sm font-semibold rounded-xl hover:bg-[#1E88E5] ml-auto">＋ 記録</button>
            </div>
            <WeightSummaryCard weights={weights} settings={settings} />
            <WeightChart weights={weights} settings={settings} />
            <h2 className="text-sm font-bold text-gray-700 mb-2 mt-4">記録履歴</h2>
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
          </>
        )}
      </div>

      {/* ── モーダル ── */}
      <NicknameModal open={showNickname} onClose={() => setShowNickname(false)} current={displayName} onSave={updateNickname} />

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

      {selectedDate && (
        <DayDetailModal
          open={true}
          onClose={() => setSelectedDate(null)}
          date={selectedDate}
          meals={meals}
          exercises={exercises}
          onDeleteMeal={deleteMeal}
          onDeleteExercise={deleteExercise}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, unit, accent }: {
  label: string; value: number; unit: string; accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 px-4 py-3">
      <p className="text-[11px] font-bold text-gray-400 mb-1">{label}</p>
      <p className="flex items-baseline gap-1">
        <span className="text-2xl font-black tabular-nums" style={{ color: accent }}>
          {value.toLocaleString()}
        </span>
        <span className="text-xs font-bold text-gray-400">{unit}</span>
      </p>
    </div>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3.5 ${last ? '' : 'border-b border-gray-100'}`}>
      <span className="text-sm font-bold text-gray-500">{label}</span>
      <span className="text-sm font-black text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}
