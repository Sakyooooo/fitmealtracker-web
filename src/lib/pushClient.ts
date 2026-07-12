/**
 * Web Push の購読管理。
 *
 * アプリを閉じていても届く通知はこの経路のみ（従来の setInterval/Periodic Sync は
 * タブが生きている間のフォールバックとして mealReminder.ts に残す）。
 * 「通知ON」= この端末の endpoint が push_subscriptions に存在する、として扱う。
 */

import { supabase, supabaseEnabled } from './supabase';
import { ensureAuthUserId } from './identity';

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))).buffer as ArrayBuffer;
}

/** このブラウザ/OSがWeb Pushに対応しているか（iOSはホーム画面追加PWAのみ対応）。 */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

function toBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

/**
 * 通知を購読する。権限リクエスト→pushManager.subscribe→Supabaseへ保存、まで一括で行う。
 * iOSはユーザー操作（クリック等）から直接呼ばれるハンドラ内で実行すること。
 */
export async function subscribeToPush(): Promise<{ error: string | null }> {
  if (!isPushSupported()) return { error: 'この環境はプッシュ通知に対応していません' };
  if (!supabaseEnabled || !supabase) return { error: 'Supabaseが未設定です' };

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { error: 'VAPID鍵が未設定です' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { error: '通知が許可されませんでした' };

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh ?? toBase64(sub.getKey('p256dh'));
    const auth = json.keys?.auth ?? toBase64(sub.getKey('auth'));

    const userId = await ensureAuthUserId();
    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: sub.endpoint, p256dh, auth },
      { onConflict: 'endpoint' },
    );
    if (error) return { error: error.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : '購読に失敗しました' };
  }
}

/** この端末の購読を解除する（DB側の行も削除）。 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    if (supabaseEnabled && supabase) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
  } catch { /* ignore */ }
}

/** この端末が現在購読済みか。 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    const sub = await reg?.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
