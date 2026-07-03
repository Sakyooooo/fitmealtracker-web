import { MealEntry, MealCategory } from './types';
import { getMealsByDate, todayString } from './stats';

const ENABLED_KEY = 'fmt_meal_notifications_enabled';
const SW_CACHE = 'fmt-sw-settings-v1';
const SW_ENABLED_KEY = '/fmt-notif-enabled';
const SW_SLOTS_KEY = '/fmt-notif-slots';
const SW_CONFIG_KEY = '/fmt-notif-config'; // リマインダー時刻の設定（SWへの配信用）

export type ReminderSlot = {
  time: string;       // "HH:MM"
  category: MealCategory;
  label: string;
};

// リマインダー時刻の唯一の定義。
// SW(public/sw.js)はこれを Cache API 経由で受け取るため（syncSlotsToSw）、
// 時刻を変えるときはここだけを直せばよい（sw.js 側はフォールバック既定値のみ持つ）。
export const REMINDER_SLOTS: ReminderSlot[] = [
  { time: '07:00', category: '朝食', label: '朝食の時間です' },
  { time: '12:00', category: '昼食', label: '昼食の時間です' },
  { time: '18:00', category: '夕食', label: '夕食の時間です' },
];

// ── SW登録・Periodic Sync ────────────────────────────────────────────────────

export async function registerMealReminderSW(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    // リマインダー時刻を SW へ配信（背景通知が REMINDER_SLOTS を参照できるように）
    await syncSlotsToSw();
    // Periodic Background Sync（対応ブラウザのみ）
    if ('periodicSync' in reg) {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as PermissionName,
      });
      if (status.state === 'granted') {
        await (reg as unknown as { periodicSync: { register: (tag: string, opts: object) => Promise<void> } })
          .periodicSync.register('meal-reminder', { minInterval: 60 * 60 * 1000 }); // 1時間
      }
    }
  } catch {
    // SW登録失敗は無視（通知はタブ側 setInterval で継続）
  }
}

// ── Cache API helpers（SWと共有） ────────────────────────────────────────────

async function swCachePut(key: string, value: string): Promise<void> {
  if (!('caches' in window)) return;
  try {
    const c = await caches.open(SW_CACHE);
    await c.put(key, new Response(value));
  } catch { /* ignore */ }
}

/** リマインダー時刻(REMINDER_SLOTS)を Cache API に書き、SWの背景通知へ配信する。 */
async function syncSlotsToSw(): Promise<void> {
  await swCachePut(SW_CONFIG_KEY, JSON.stringify(REMINDER_SLOTS));
}

async function getSwNotifiedSlots(): Promise<string[]> {
  if (!('caches' in window)) return [];
  try {
    const today = todayString();
    const c = await caches.open(SW_CACHE);
    const res = await c.match(SW_SLOTS_KEY);
    if (!res) return [];
    const data: { date: string; slots: string[] } = await res.json();
    return data.date === today ? (data.slots ?? []) : [];
  } catch {
    return [];
  }
}

async function markSwSlotNotified(time: string): Promise<void> {
  const today = todayString();
  const existing = await getSwNotifiedSlots();
  if (!existing.includes(time)) existing.push(time);
  await swCachePut(SW_SLOTS_KEY, JSON.stringify({ date: today, slots: existing }));
}

// ── 有効/無効 ────────────────────────────────────────────────────────────────

export function getNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ENABLED_KEY) === 'true';
}

export async function setNotificationsEnabled(v: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENABLED_KEY, v ? 'true' : 'false');
  // SW 側の Cache にも書き込む
  await swCachePut(SW_ENABLED_KEY, v ? 'true' : 'false');
  // 有効化時は最新のリマインダー時刻も配信しておく
  if (v) await syncSlotsToSw();
  // SW に通知
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    reg?.active?.postMessage({ type: 'SET_ENABLED', value: v });
  }
}

// ── タブ内チェック（setInterval から呼ぶ） ───────────────────────────────────

function currentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function hasMealForCategory(meals: MealEntry[], category: MealCategory): boolean {
  return getMealsByDate(meals, todayString()).some((m) => m.category === category);
}

export async function checkAndNotify(meals: MealEntry[]): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!getNotificationsEnabled()) return;
  if (Notification.permission !== 'granted') return;

  const hhmm = currentHHMM();
  const notified = await getSwNotifiedSlots();

  for (const slot of REMINDER_SLOTS) {
    if (slot.time !== hhmm) continue;
    if (notified.includes(slot.time)) continue;
    // 食事が記録済みならスキップ（タブ側のみ可能なチェック）
    if (hasMealForCategory(meals, slot.category)) {
      await markSwSlotNotified(slot.time);
      continue;
    }
    await markSwSlotNotified(slot.time);
    // SW 経由で通知（アクティブな SW があれば）
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg?.active) {
      reg.active.postMessage({ type: 'CHECK_REMINDER' });
    } else {
      new Notification('FitMealTracker', {
        body: `${slot.label}！今日の${slot.category}をまだ記録していません。`,
        icon: '/icon.svg',
        tag: `meal-reminder-${slot.time}`,
      });
    }
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}
