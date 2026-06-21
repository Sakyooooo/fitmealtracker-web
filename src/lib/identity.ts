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
 *
 * ※ フォールバック専用。通常は ensureAuthUserId() を使うこと。
 */
export function getOrCreateUserId(): string {
  const stored = localStorage.getItem(STORAGE_KEY_USER_ID);
  if (stored) return stored;

  const id = generateUUID();
  localStorage.setItem(STORAGE_KEY_USER_ID, id);
  return id;
}

/**
 * 本人IDを確定して返す。
 *
 * Supabase 匿名認証（Anonymous Sign-In）でセッションを張り、その auth.uid() を
 * 本人IDとして使う。これにより「クライアントが user_id を自称する」状態を脱し、
 * RLS が `user_id = auth.uid()` で本人を識別できるようになる（F1/F2 の根本対策）。
 *
 * - ログイン画面は出ない（裏で自動・無音）。
 * - 匿名サインインが未許可（ダッシュボードのトグルOFF）やオフライン時は、
 *   従来の localStorage UUID にフォールバックして“今まで通り”動作する。
 *   → 段階移行を安全にするための保険。
 */
let identityPromise: Promise<string> | null = null;

export function ensureAuthUserId(): Promise<string> {
  // セッション内で一度だけ解決（毎回のサインイン試行とログ多発を防ぐ）。
  // トグルを後からONにした場合は次回リロードで反映される。
  if (!identityPromise) identityPromise = resolveIdentity();
  return identityPromise;
}

async function resolveIdentity(): Promise<string> {
  if (!supabaseEnabled || !supabase) return getOrCreateUserId();

  try {
    // 既存セッションがあれば即利用（ネットワーク不要）
    const { data: sessionData } = await supabase.auth.getSession();
    const existingId = sessionData.session?.user?.id;
    if (existingId) return existingId;

    // 無ければ匿名サインイン（無音・自動）
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error && data.user?.id) return data.user.id;

    if (error) {
      console.warn(
        '[identity] 匿名サインイン不可（Supabaseダッシュボードで Anonymous Sign-In を有効化してください）:',
        error.message,
      );
    }
  } catch (err) {
    console.warn('[identity] ensureAuthUserId フォールバック:', err);
  }

  // 未許可・失敗時は従来IDで継続（段階移行の保険）
  return getOrCreateUserId();
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
 * プロフィール画像（data URL）を Supabase の users.avatar_url に保存する。
 * null を渡すと画像を削除（NULL）にする。フレンドにも共有される。
 */
export async function updateAvatar(
  userId: string,
  dataUrl: string | null,
): Promise<boolean> {
  if (!supabaseEnabled || !supabase) return false;
  try {
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: dataUrl })
      .eq('id', userId);
    if (error) {
      console.error('[identity] updateAvatar:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[identity] updateAvatar (network):', err);
    return false;
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

// ── アカウント連携 / サインイン（任意・データ復元用） ──────────────────────────
//
// 既定は匿名ユーザー。希望者だけ Google / メールを「連携」して永続化すると、
// 端末を変えても・ストレージを消しても、サインインで同じ uid に復帰できる。
//   - linkGoogle / linkEmail : 現在の匿名アカウントを格上げ（uid 維持）
//   - signInWithGoogle / signInWithEmail : 別端末/初期化後に連携済みアカウントへ復帰
// ※ いずれも Supabase ダッシュボードでプロバイダ設定（Google有効化／メール送信）が必要。

export type AuthInfo = {
  isAnonymous: boolean;
  email: string | null;
  providers: string[]; // 例: 'google', 'email'
};

/** 現在の認証状態を返す（匿名か、連携済みか）。 */
export async function getAuthInfo(): Promise<AuthInfo | null> {
  if (!supabaseEnabled || !supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const u = data.user;
  const providers = (u.identities ?? [])
    .map((i) => i.provider)
    .filter((p) => p !== 'anonymous');
  const isAnon = (u as { is_anonymous?: boolean }).is_anonymous ?? (!u.email && providers.length === 0);
  return { isAnonymous: isAnon, email: u.email ?? null, providers };
}

function authRedirectTo(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/profile`;
}

/** 現在の(匿名)アカウントに Google を紐付けて永続化（同じ uid を保持）。 */
export async function linkGoogle(): Promise<{ error: string | null }> {
  if (!supabaseEnabled || !supabase) return { error: 'Supabaseが未設定です' };
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: authRedirectTo() },
  });
  return { error: error?.message ?? null };
}

/** 現在の(匿名)アカウントにメールを紐付け（確認メールが届く）。 */
export async function linkEmail(email: string): Promise<{ error: string | null }> {
  if (!supabaseEnabled || !supabase) return { error: 'Supabaseが未設定です' };
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: authRedirectTo() },
  );
  return { error: error?.message ?? null };
}

/** 別端末/初期化後に、連携済み Google アカウントへサインインして復帰。 */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (!supabaseEnabled || !supabase) return { error: 'Supabaseが未設定です' };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectTo() },
  });
  return { error: error?.message ?? null };
}

/** 連携済みメールへマジックリンクを送ってサインイン（復帰）。 */
export async function signInWithEmail(email: string): Promise<{ error: string | null }> {
  if (!supabaseEnabled || !supabase) return { error: 'Supabaseが未設定です' };
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: authRedirectTo() },
  });
  return { error: error?.message ?? null };
}

export async function signOutAuth(): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
}
