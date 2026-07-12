import type { User } from '@supabase/supabase-js';
import { supabase, supabaseEnabled } from './supabase';
import {
  STORAGE_KEY_USER_ID,
  STORAGE_KEY_FRIEND_CODE,
  STORAGE_KEY_DISPLAY_NAME,
  STORAGE_KEY_IDENTITY_MODE,
  STORAGE_KEY_LAST_IDENTITY,
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

function isAnonUser(user: User): boolean {
  return (user as { is_anonymous?: boolean }).is_anonymous ?? false;
}

/** 前回解決した identity を記録（uid変化の検知＝マージ同期の要否判定に使う） */
function rememberIdentity(uid: string, anonymous: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_IDENTITY, JSON.stringify({ uid, anonymous }));
  } catch { /* quota */ }
}

export function getLastIdentity(): { uid: string; anonymous: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_IDENTITY);
    return raw ? (JSON.parse(raw) as { uid: string; anonymous: boolean }) : null;
  } catch {
    return null;
  }
}

/** OAuthコールバック処理中か（この間は匿名発行・復元ゲートを抑止する） */
function isOAuthCallbackContext(): boolean {
  if (typeof window === 'undefined') return false;
  const { pathname, search, hash } = window.location;
  return pathname.startsWith('/auth/callback')
    || search.includes('code=')
    || hash.includes('access_token=');
}

// 復元ゲート: セッションが無い（＝初回 or ストレージ消失後）とき、無言で新しい
// 匿名IDを発行せず、ユーザーの選択（ログインして復元 / 新しく始める）を待つ。
// 旧実装は即 signInAnonymously しており、消失後に別人IDで上書き運用が始まって
// 記録・フレンドが見えなくなる事故の温床だった。
let gateResolve: ((uid: string) => void) | null = null;

/** 復元ゲートを表示すべきか（クライアント専用） */
export async function needsIdentityGate(): Promise<boolean> {
  if (!supabaseEnabled || !supabase || typeof window === 'undefined') return false;
  if (isOAuthCallbackContext()) return false;
  // 「新しく始める」選択済みの端末は従来どおり無音で匿名継続
  if (localStorage.getItem(STORAGE_KEY_IDENTITY_MODE) === 'anonymous') return false;
  const { data } = await supabase.auth.getSession();
  return !data.session;
}

/** 復元ゲートで「新しく始める」を選んだとき。匿名IDを発行して identity を解決する。 */
export async function startAsNewAnonymous(): Promise<string> {
  let uid: string;
  try {
    const { data, error } = await supabase!.auth.signInAnonymously();
    uid = !error && data.user?.id ? data.user.id : getOrCreateUserId();
  } catch {
    uid = getOrCreateUserId();
  }
  try { localStorage.setItem(STORAGE_KEY_IDENTITY_MODE, 'anonymous'); } catch { /* quota */ }
  rememberIdentity(uid, true);
  gateResolve?.(uid);
  gateResolve = null;
  return uid;
}

async function resolveIdentity(): Promise<string> {
  if (!supabaseEnabled || !supabase) return getOrCreateUserId();

  try {
    // 既存セッションがあれば即利用（ネットワーク不要）
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (user?.id) {
      // 前回と同じuidのときだけ記録を更新（別uidはマージ同期側が処理してから更新する）
      const last = getLastIdentity();
      if (!last || last.uid === user.id) rememberIdentity(user.id, isAnonUser(user));
      return user.id;
    }

    // OAuthコールバック処理中はセッション確立を待つ。
    // ここで匿名サインインするとサインイン成立前に別IDを作ってしまう。
    if (isOAuthCallbackContext()) {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 250));
        const { data } = await supabase.auth.getSession();
        const u = data.session?.user;
        if (u?.id) return u.id;
      }
      return getOrCreateUserId();
    }

    // 「新しく始める」選択済みの端末は従来どおり無音で匿名サインイン
    if (localStorage.getItem(STORAGE_KEY_IDENTITY_MODE) === 'anonymous') {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data.user?.id) {
        rememberIdentity(data.user.id, true);
        return data.user.id;
      }
      if (error) {
        console.warn(
          '[identity] 匿名サインイン不可（Supabaseダッシュボードで Anonymous Sign-In を有効化してください）:',
          error.message,
        );
      }
      return getOrCreateUserId();
    }

    // 初回 or ストレージ消失後: 復元ゲートの選択を待つ。
    // ログインを選んだ場合はページ遷移するためこのPromiseは破棄され、
    // 「新しく始める」を選んだ場合は startAsNewAnonymous が resolve する。
    return await new Promise<string>((resolve) => { gateResolve = resolve; });
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

// ── アカウントログイン（データ永続化・復元用） ─────────────────────────────────
//
// 既定は匿名ユーザー。ログインしておくと、端末を変えても・ストレージを消しても、
// 再ログインで同じアカウントに復帰できる。導線は loginWithGoogle / loginWithEmail の
// 1本ずつ（匿名中は昇格、消失後は復帰、を内部で自動判別）。完了後は /auth/callback が
// 受け、uid が変わった場合は syncMerge.mergeAfterSignIn がデータを引き継ぐ。
// ※ Supabase ダッシュボードでプロバイダ設定（Google有効化／メール送信）が必要。

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

function authCallbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

/**
 * ログイン導線は常にこれ1本。
 * - 匿名セッション中: linkIdentity で昇格を試みる（uid維持＝データ無傷）。
 *   そのGoogleが既存アカウントに紐付いている場合はOAuth後にエラーが返り、
 *   /auth/callback が signInWithOAuth へ自動フォールバックする。
 * - セッションなし（ストレージ消失後など）: signInWithOAuth で復帰
 *   （既存ならそのアカウントへ、初見なら新規作成）。
 */
export async function loginWithGoogle(): Promise<{ error: string | null }> {
  if (!supabaseEnabled || !supabase) return { error: 'Supabaseが未設定です' };
  const redirectTo = authCallbackUrl();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user && isAnonUser(user)) {
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo },
    });
    return { error: error?.message ?? null };
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  return { error: error?.message ?? null };
}

/**
 * メールでのログイン（Googleと同じ一本化方針）。
 * 匿名中はメール紐付け（確認メール）、それ以外はマジックリンクでサインイン。
 */
export async function loginWithEmail(email: string): Promise<{ error: string | null }> {
  if (!supabaseEnabled || !supabase) return { error: 'Supabaseが未設定です' };
  const redirectTo = authCallbackUrl();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user && isAnonUser(user)) {
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
      { emailRedirectTo: redirectTo },
    );
    return { error: error?.message ?? null };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: redirectTo },
  });
  return { error: error?.message ?? null };
}

export async function signOutAuth(): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  try { await supabase.auth.signOut(); } catch { /* ignore */ }
}
