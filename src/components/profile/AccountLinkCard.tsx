'use client';

import { useState, useEffect } from 'react';
import { supabaseEnabled } from '@/lib/supabase';
import {
  getAuthInfo, linkGoogle, linkEmail,
  signInWithGoogle, signInWithEmail, signOutAuth,
  type AuthInfo,
} from '@/lib/identity';
import { syncDownAllFromSupabase } from '@/lib/supabaseRepository';

const ACCENT = '#AB47BC';

export default function AccountLinkCard() {
  const [info, setInfo] = useState<AuthInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    getAuthInfo().then((i) => { setInfo(i); setLoaded(true); });
  }, []);

  if (!supabaseEnabled || !loaded) return null;

  const linked = info ? !info.isAnonymous : false;
  const linkedLabel = info?.email
    ? info.email
    : info?.providers.includes('google') ? 'Googleアカウント' : '連携済み';

  async function doLinkGoogle() {
    setBusy(true); setMsg(null);
    const { error } = await linkGoogle();
    if (error) { setMsg(`連携に失敗しました: ${error}`); setBusy(false); }
    // 成功時は Google へリダイレクト
  }
  async function doLinkEmail() {
    const e = email.trim();
    if (!e) return;
    setBusy(true); setMsg(null);
    const { error } = await linkEmail(e);
    setBusy(false);
    setMsg(error
      ? `連携に失敗しました: ${error}`
      : `${e} に確認メールを送りました。メール内のリンクを開くと連携が完了します。`);
  }
  async function doSignInGoogle() {
    setBusy(true); setMsg(null);
    const { error } = await signInWithGoogle();
    if (error) { setMsg(`サインインに失敗しました: ${error}`); setBusy(false); }
  }
  async function doSignInEmail() {
    const e = email.trim();
    if (!e) return;
    setBusy(true); setMsg(null);
    const { error } = await signInWithEmail(e);
    setBusy(false);
    setMsg(error
      ? `サインインに失敗しました: ${error}`
      : `${e} にサインイン用リンクを送りました。メールのリンクを開いてください。`);
  }
  async function doRestore() {
    setBusy(true); setMsg(null);
    try {
      const r = await syncDownAllFromSupabase();
      alert(`クラウドから復元しました（食事${r.meals}・運動${r.exercises}・体重${r.weights}・マイ食品${r.myFoods}）。再読み込みします。`);
      window.location.reload();
    } catch {
      setMsg('復元に失敗しました。通信状況を確認してください。');
      setBusy(false);
    }
  }
  async function doSignOut() {
    if (!window.confirm('サインアウトしますか？（この端末のローカル記録は消えません）')) return;
    await signOutAuth();
    window.location.reload();
  }

  const inputCls = 'flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#AB47BC] bg-white';
  const btnPrimary = 'px-3 py-2 rounded-xl text-xs font-black text-white disabled:opacity-50';

  return (
    <div className="mb-5">
      <p className="text-xs font-black text-gray-400 tracking-widest uppercase mb-2">Account</p>
      <div className="rounded-2xl border border-gray-100 p-4">
        {linked ? (
          // ── 連携済み ──
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black text-gray-900">✅ 連携済み</span>
              <span className="text-xs font-bold text-gray-400 truncate">{linkedLabel}</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-snug mb-3">
              別の端末でも、同じGoogleまたはメールでサインインすればこのアカウントとフレンドCD・記録を引き継げます。
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={doRestore} disabled={busy}
                className={`${btnPrimary} w-full py-2.5`} style={{ background: ACCENT }}>
                ☁️ クラウドから記録を復元
              </button>
              <button type="button" onClick={doSignOut} disabled={busy}
                className="w-full py-2 text-xs font-bold text-gray-400 hover:text-gray-600">
                サインアウト
              </button>
            </div>
          </>
        ) : (
          // ── 未連携（匿名） ──
          <>
            <p className="text-sm font-black text-gray-900 mb-1">🔐 アカウントを連携（バックアップ）</p>
            <p className="text-[11px] text-gray-400 leading-snug mb-3">
              いまは匿名アカウントです。GoogleかメールでログインしておくとブラウザのデータやPWAを消しても、サインインで記録とフレンドを復元できます。
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={doLinkGoogle} disabled={busy}
                className="w-full py-2.5 rounded-xl text-xs font-black text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2">
                <span className="text-base">G</span> Googleで連携
              </button>
              <div className="flex gap-2">
                <input type="email" inputMode="email" placeholder="メールアドレス" value={email}
                  onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                <button type="button" onClick={doLinkEmail} disabled={busy || !email.trim()}
                  className={btnPrimary} style={{ background: ACCENT }}>
                  連携
                </button>
              </div>
            </div>

            <button type="button" onClick={() => { setShowSignIn((v) => !v); setMsg(null); }}
              className="mt-3 text-[11px] font-bold text-gray-400 hover:text-gray-600">
              別端末で連携済みの方はこちら（サインインして復元） {showSignIn ? '▲' : '▼'}
            </button>
            {showSignIn && (
              <div className="mt-2 flex flex-col gap-2 bg-gray-50 rounded-xl p-3">
                <button type="button" onClick={doSignInGoogle} disabled={busy}
                  className="w-full py-2 rounded-xl text-xs font-black text-gray-700 border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-50">
                  Googleでサインイン
                </button>
                <div className="flex gap-2">
                  <input type="email" inputMode="email" placeholder="メールアドレス" value={email}
                    onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                  <button type="button" onClick={doSignInEmail} disabled={busy || !email.trim()}
                    className="px-3 py-2 rounded-xl text-xs font-black text-gray-700 border border-gray-200 bg-white disabled:opacity-50">
                    リンク送信
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 leading-snug">
                  サインイン後、上に表示される「クラウドから記録を復元」で食事・運動・体重を取り込めます。
                </p>
              </div>
            )}
          </>
        )}

        {msg && <p className="text-[11px] text-gray-600 mt-3 leading-snug">{msg}</p>}
      </div>
    </div>
  );
}
