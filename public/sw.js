// FitMealTracker — Meal Reminder Service Worker
const CACHE = 'fmt-sw-settings-v1';
const ENABLED_KEY = '/fmt-notif-enabled';
const SLOTS_KEY = '/fmt-notif-slots';
const PERIODIC_TAG = 'meal-reminder';

const REMINDER_SLOTS = [
  { time: '07:00', category: '朝食', label: '朝食の時間です' },
  { time: '12:00', category: '昼食', label: '昼食の時間です' },
  { time: '18:00', category: '夕食', label: '夕食の時間です' },
];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── Periodic Background Sync（バックグラウンド） ─────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === PERIODIC_TAG) {
    event.waitUntil(checkAndNotify());
  }
});

// ── タブからの即時チェック要求 ────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_REMINDER') {
    checkAndNotify();
  }
  if (event.data?.type === 'SET_ENABLED') {
    setEnabled(event.data.value).catch(() => {});
  }
});

// ── Cache API helpers ────────────────────────────────────────────────────────
async function getCache() {
  return caches.open(CACHE);
}

async function isEnabled() {
  try {
    const c = await getCache();
    const res = await c.match(ENABLED_KEY);
    if (!res) return false;
    return (await res.text()) === 'true';
  } catch {
    return false;
  }
}

async function setEnabled(value) {
  try {
    const c = await getCache();
    await c.put(ENABLED_KEY, new Response(value ? 'true' : 'false'));
  } catch { /* ignore */ }
}

async function getNotifiedSlots() {
  try {
    const today = todayStr();
    const c = await getCache();
    const res = await c.match(SLOTS_KEY);
    if (!res) return [];
    const data = await res.json();
    return data.date === today ? (data.slots ?? []) : [];
  } catch {
    return [];
  }
}

async function markSlotNotified(time) {
  try {
    const today = todayStr();
    const existing = await getNotifiedSlots();
    if (!existing.includes(time)) existing.push(time);
    const c = await getCache();
    await c.put(SLOTS_KEY, new Response(JSON.stringify({ date: today, slots: existing })));
  } catch { /* ignore */ }
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 現在時刻がスロット時刻の ±5 分以内か（periodic sync は発火タイミングがずれるため）
function isNearSlot(slotTime) {
  const [sh, sm] = slotTime.split(':').map(Number);
  const slotMin = sh * 60 + sm;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return Math.abs(nowMin - slotMin) <= 5;
}

// ── 通知チェック本体 ─────────────────────────────────────────────────────────
async function checkAndNotify() {
  if (!(await isEnabled())) return;
  if (Notification.permission !== 'granted') return;

  const hhmm = currentHHMM();
  const notified = await getNotifiedSlots();

  for (const slot of REMINDER_SLOTS) {
    // タブ経由（CHECK_REMINDER）は完全一致、periodic sync は ±5 分ウィンドウ
    const matches = slot.time === hhmm || isNearSlot(slot.time);
    if (!matches) continue;
    if (notified.includes(slot.time)) continue;

    await markSlotNotified(slot.time);
    await self.registration.showNotification('FitMealTracker', {
      body: `${slot.label}！今日の${slot.category}をまだ記録していません。`,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: `meal-reminder-${slot.time}`,
      renotify: false,
    });
  }
}

// ── 通知クリックでアプリを開く ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    }),
  );
});
