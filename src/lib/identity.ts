import { supabase, supabaseEnabled } from './supabase';
import {
  STORAGE_KEY_USER_ID,
  STORAGE_KEY_FRIEND_CODE,
  STORAGE_KEY_DISPLAY_NAME,
} from './constants';

// ── UUID ──────────────────────────────────────────────────────────────────────

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // フォールバック（古い環境）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * localStorage からユーザー ID を取得。
 * 存在しない場合は新規 UUID を生成して保存する。
 * SSR では呼ばれないよう呼び出し側で注意すること。
 */
export function getOrCreateUserId(): string {
  const stored = localStorage.getItem(STORAGE_KEY_USER_ID);
  if (stored) return stored;

  const id = generateUUID();
  localStorage.setItem(STORAGE_KEY_USER_ID, id);
  return id;
}

// ── フレンドコード ─────────────────────────────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外

function randomCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `FMT-${code}`;
}

// ── Supabase 同期 ──────────────────────────────────────────────────────────────

/**
 * Supabase の users テーブルにユーザーを登録 / 取得する。
 * 既存ユーザーの場合は何もしない（UPSERT）。
 * Supabase が無効の場合は即 return。
 */
export async function syncUserToSupabase(userId: string): Promise<string | null> {
  if (!supabaseEnabled || !supabase) return null;

  try {
    // 既存チェック
    const { data: existing, error: selectErr } = await supabase
      .from('users')
      .select('friend_code')
      .eq('id', userId)
      .maybeSingle();

    if (selectErr) {
      console.error('[identity] syncUserToSupabase (select):', selectErr.message);
      return null;
    }
    if (existing) return existing.friend_code as string;

    // 新規登録：重複しないコードを最大3回試みる
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = randomCode();
      const { error } = await supabase.from('users').insert({
        id: userId,
        friend_code: code,
        display_name: null,
      });

      if (!error) return code;
      // UNIQUE 制約違反（23505）以外は即エラー
      if ((error as { code?: string }).code !== '23505') {
        console.error('[identity] syncUserToSupabase (insert):', error.message);
        return null;
      }
    }

    console.error('[identity] フレンドコードの生成に3回失敗しました');
    return null;
  } catch (err) {
    console.error('[identity] syncUserToSupabase (network):', err);
    return null;
  }
}

/**
 * 自分のフレンドコードを Supabase から取得する。
 */
export async function getMyFriendCode(userId: string): Promise<string | null> {
  if (!supabaseEnabled || !supabase) return null;

  const { data } = await supabase
    .from('users')
    .select('friend_code')
    .eq('id', userId)
    .maybeSingle();

  return (data?.friend_code as string) ?? null;
}

// ── localStorage キャッシュ ────────────────────────────────────────────────────

/** フレンドコードをキャッシュに書く */
export function cacheFriendCode(code: string): void {
  try { localStorage.setItem(STORAGE_KEY_FRIEND_CODE, code); } catch { /* quota */ }
}

/** キャッシュからフレンドコードを読む（未設定なら null） */
export function getCachedFriendCode(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_FRIEND_CODE);
}

/** 表示名をキャッシュに書く */
export function cacheDisplayName(name: string): void {
  try { localStorage.setItem(STORAGE_KEY_DISPLAY_NAME, name); } catch { /* quota */ }
}

/** キャッシュから表示名を読む（未設定なら null） */
export function getCachedDisplayName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY_DISPLAY_NAME);
}

// ── ニックネーム更新 ───────────────────────────────────────────────────────────

/**
 * Supabase の users テーブルの display_name を更新し、キャッシュにも書く。
 * 空文字が渡された場合は NULL にリセットする。
 */
export async function updateDisplayName(
  userId: string,
  name: string,
): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return false;

  const trimmed = name.trim();
  const value = trimmed === '' ? null : trimmed;

  try {
    const { error } = await supabase
      .from('users')
      .update({ display_name: value })
      .eq('id', userId);

    if (error) {
      console.error('[identity] updateDisplayName:', error.message);
      return false;
    }

    // キャッシュ更新（null なら削除）
    if (value) {
      cacheDisplayName(value);
    } else {
      try { localStorage.removeItem(STORAGE_KEY_DISPLAY_NAME); } catch { /* quota */ }
    }

    return true;
  } catch (err) {
    console.error('[identity] updateDisplayName (network):', err);
    return false;
  }
}
