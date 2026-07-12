'use client';

import { useState, useEffect } from 'react';
import { supabaseEnabled } from '@/lib/supabase';
import {
  getAuthInfo, loginWithGoogle, loginWithEmail, signOutAuth,
  type AuthInfo,
} from '@/lib/identity';
import { resyncNow } from '@/lib/syncMerge';

const ACCENT = '#AB47BC';

export default function AccountLinkCard() {
  const [info, setInfo] = useState<AuthInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAuthInfo().then((i) => { setInfo(i); setLoaded(true); });
  }, []);

  if (!supabaseEnabled || !loaded) return null;

  const linked = info ? !info.isAnonymous : false;
  const linkedLabel = info?.email
    ? info.email
    : info?.providers.includes('google') ? 'Googleアカウント' : '連携済み';

  async function doGoogle() {
    setBusy(true); setMsg(null);
    const { error } = await loginWithGoogle();
    if (error) { setMsg(`ログインに失敗しました: ${error}`); setBusy(false); }
    // 成功時は Google へリダイレクト → /auth/callback で同期される
  }
  async function doEmail() {
    const e = email.trim();
    if (!e) return;
    setBusy(true); setMsg(null);
    const { error } = await loginWithEmail(e);
    setBusy(false);
    setMsg(error
      ? `送信に失敗しました: ${error}`
      : `${e} にログイン用リンクを送りました。メールのリンクを開くと完了します。`);
  }
  async function doResync() {
    setBusy(true); setMsg(null);
    try {
      const summary = await resyncNow();
      setMsg(`✅ ${summary} — 再読み込みします`);
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      setMsg('再同期に失敗しました。通信状況を確認してください。');
      setBusy(false);
    }
  }
  async function doSignOut() {
    if (!window.confirm('サインアウトしますか？（この端末のローカル記録は消えません）')) return;
    await signOutAuth();
    window.location.reload();
  }

  const inputCls = 'flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#AB47BC] bg-white';

  return (
    <div className="mb-5">
      <p className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2">Account</p>
      <div className="rounded-2xl border border-gray-100 p-4">
        {linked ? (
          // ── ログイン済み ──
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black text-gray-900">✅ ログイン済み</span>
              <span className="text-xs font-bold text-gray-400 truncate">{linkedLabel}</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-snug mb-3">
              記録は自動でこのアカウントに紐付きます。別の端末でも同じアカウントでログインすれば記録・フレンドを引き継げます。
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={doResync} disabled={busy}
                className="w-full py-2.5 rounded-xl text-xs font-black text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50">
                🔄 今すぐ再同期
              </button>
              <button type="button" onClick={doSignOut} disabled={busy}
                className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600">
                サインアウト
              </button>
            </div>
          </>
        ) : (
          // ── 未ログイン（匿名） ──
          <>
            <p className="text-sm font-black text-gray-900 mb-1">🔐 ログイン（バックアップ）</p>
            <p className="text-[11px] text-gray-400 leading-snug mb-3">
              いまは匿名アカウントです。ログインしておくと、端末の変更やデータ消失時に記録とフレンドを復元できます。
              以前ログインしていた方も、はじめての方も、このボタン1つでOKです。
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={doGoogle} disabled={busy}
                className="w-full py-2.5 rounded-xl text-xs font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: ACCENT }}>
                <span className="text-base">G</span> Googleでログイン
              </button>
              <div className="flex gap-2">
                <input type="email" inputMode="email" placeholder="メールアドレス" value={email}
                  onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                <button type="button" onClick={doEmail} disabled={busy || !email.trim()}
                  className="px-3 py-2 rounded-xl text-xs font-black text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50">
                  メールでログイン
                </button>
              </div>
            </div>
          </>
        )}

        {msg && <p className="text-[11px] text-gray-600 mt-3 leading-snug">{msg}</p>}
      </div>
    </div>
  );
}
