'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFriends } from '@/hooks/useFriends';
import { fetchMeals, fetchExercises, fetchWeights, loadSettings, saveSettings } from '@/lib/localRepository';
import { AppSettings } from '@/lib/types';
import { fileToSquareDataUrl } from '@/lib/imageResize';
import { updateAvatar } from '@/lib/identity';
import NicknameModal from '@/components/friends/NicknameModal';

const ACCENT = '#AB47BC';
const minHeight = 'calc(100svh - 130px)';

type Stats = {
  monthBurned: number;
  monthIntake: number;
  mealCount: number;
  exerciseCount: number;
  latestWeight: number | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { userId, friendCode, displayName, updateNickname } = useFriends();

  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<AppSettings>({});
  const [location, setLocation] = useState('');
  const [showNickname, setShowNickname] = useState(false);
  const [copied, setCopied] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const [meals, exercises, weights] = await Promise.all([
        fetchMeals(), fetchExercises(), fetchWeights(),
      ]);
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const monthMeals = meals.filter((m) => m.date.startsWith(ym));
      const monthEx = exercises.filter((e) => e.date.startsWith(ym));
      const sortedWeights = [...weights].sort((a, b) => b.date.localeCompare(a.date));

      setStats({
        monthBurned: monthEx.reduce((s, e) => s + e.caloriesBurned, 0),
        monthIntake: monthMeals.reduce((s, m) => s + m.calories, 0),
        mealCount: monthMeals.length,
        exerciseCount: monthEx.length,
        latestWeight: sortedWeights[0]?.weightKg ?? null,
      });
      const s = loadSettings();
      setSettings(s);
      setLocation(s.location ?? '');
      setAvatarUrl(s.avatarUrl);
    })();
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルを連続選択しても発火するように
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('画像ファイルを選択してください。'); return; }
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      const next = { ...loadSettings(), avatarUrl: dataUrl };
      saveSettings(next);
      setSettings(next);
      setAvatarUrl(dataUrl);
      // フレンドにも共有（Supabase users.avatar_url）
      if (userId) updateAvatar(userId, dataUrl).catch(() => {});
    } catch {
      alert('画像の処理に失敗しました。');
    }
  }

  function removeAvatar() {
    const s = loadSettings();
    const next = { ...s };
    delete next.avatarUrl;
    saveSettings(next);
    setSettings(next);
    setAvatarUrl(undefined);
    if (userId) updateAvatar(userId, null).catch(() => {});
  }

  function saveLocation() {
    const s = loadSettings();
    const next = { ...s, location: location.trim() || undefined };
    saveSettings(next);
    setSettings(next);
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

  const name = displayName ?? friendCode ?? 'You';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative min-h-screen bg-white">
      <div className="relative z-10 flex flex-col" style={{ minHeight }}>

        {/* ── ヘッダー（戻る） ── */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <button type="button" onClick={() => router.push('/friends')}
            className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">プロフィール</h1>
        </div>

        {/* ── プロフィールカード ── */}
        <div className="flex flex-col items-center px-4 pt-6 pb-4">
          <div className="relative">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full flex items-center justify-center shadow-lg overflow-hidden"
              style={{ background: ACCENT }}
              aria-label="プロフィール画像を変更">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="プロフィール画像" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-black text-white">{initial}</span>
              )}
            </button>
            {/* カメラバッジ */}
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-100"
              aria-label="プロフィール画像を変更">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*"
              onChange={handleAvatarChange} className="hidden" />
          </div>
          {avatarUrl && (
            <button type="button" onClick={removeAvatar}
              className="mt-2 text-[11px] font-bold text-gray-400 hover:text-gray-600">
              画像を削除
            </button>
          )}

          <button type="button" onClick={() => setShowNickname(true)}
            className="flex items-center gap-1.5 mt-4">
            <span className="text-xl font-black text-gray-900">
              {displayName ?? <span className="text-gray-400 text-base font-bold">ニックネームを設定</span>}
            </span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>

          <button type="button" onClick={handleCopy}
            className="flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full bg-[#AB47BC]/10">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: ACCENT }} />
            <span className="text-xs font-black tracking-widest" style={{ color: ACCENT }}>
              {copied ? 'コピー済み ✓' : friendCode ?? '—'}
            </span>
          </button>

          {/* 地域（地球儀のラベルに表示） */}
          <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-gray-50">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <input
              type="text" placeholder="地域を入力（例: 東京・日本）" maxLength={24}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={saveLocation}
              className="bg-transparent text-xs font-bold text-gray-700 focus:outline-none placeholder:text-gray-300 w-44 text-center"
            />
          </div>
        </div>

        {/* ── 今月の統計 ── */}
        <div className="px-4 mt-2">
          <p className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2">This Month</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="消費カロリー" value={stats?.monthBurned ?? 0} unit="kcal" accent="#FF7043" />
            <StatCard label="摂取カロリー" value={stats?.monthIntake ?? 0} unit="kcal" accent="#4CAF50" />
            <StatCard label="運動の記録" value={stats?.exerciseCount ?? 0} unit="件" accent="#FF7043" />
            <StatCard label="食事の記録" value={stats?.mealCount ?? 0} unit="件" accent="#4CAF50" />
          </div>
        </div>

        {/* ── 目標・体重 ── */}
        <div className="px-4 mt-5">
          <p className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2">Goals</p>
          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <InfoRow label="現在の体重"
              value={stats?.latestWeight != null ? `${stats.latestWeight} kg` : '未記録'} />
            <InfoRow label="目標体重"
              value={settings.targetWeightKg != null ? `${settings.targetWeightKg} kg` : '未設定'} />
            <InfoRow label="目標摂取カロリー"
              value={settings.targetIntakeCalories != null ? `${settings.targetIntakeCalories} kcal` : '未設定'} last />
          </div>
        </div>
      </div>

      <NicknameModal
        open={showNickname}
        onClose={() => setShowNickname(false)}
        current={displayName}
        onSave={updateNickname}
      />
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
