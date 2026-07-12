'use client';

/**
 * 復元ゲート: セッションが無い状態（初回起動 or ストレージ消失後）で表示する
 * 全画面の選択画面。無言で新しい匿名IDを発行して「別人」として上書き運用が
 * 始まる事故を防ぐ（iOSはホーム画面PWAのストレージを消すことがある）。
 *
 *  - ログイン        → /auth/callback 経由で記録・フレンドを自動復元
 *  - 新しく始める    → 従来どおり匿名IDを発行してそのまま利用開始
 */

import { useEffect, useState } from 'react';
import {
  needsIdentityGate, startAsNewAnonymous, loginWithGoogle, loginWithEmail,
} from '@/lib/identity';

const ACCENT = '#AB47BC';

export default function RestoreGate() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    needsIdentityGate().then(setShow).catch(() => setShow(false));
  }, []);

  if (!show) return null;

  async function doGoogle() {
    setBusy(true); setMsg(null);
    const { error } = await loginWithGoogle();
    if (error) { setMsg(`ログインに失敗しました: ${error}`); setBusy(false); }
    // 成功時は Google へリダイレクト
  }

  async function doEmail() {
    const e = email.trim();
    if (!e) return;
    setBusy(true); setMsg(null);
    const { error } = await loginWithEmail(e);
    setBusy(false);
    setMsg(error
      ? `送信に失敗しました: ${error}`
      : `${e} にログイン用リンクを送りました。メールのリンクを開いてください。`);
  }

  async function doFreshStart() {
    setBusy(true); setMsg(null);
    await startAsNewAnonymous();
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-[999] bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-4xl text-center mb-3">🍽️</p>
        <h1 className="text-xl font-black text-gray-900 text-center mb-2">データの引き継ぎ</h1>
        <p className="text-xs text-gray-500 leading-relaxed text-center mb-6">
          以前このアプリを使っていた場合は、ログインすると記録・フレンドを復元できます。
        </p>

        <button
          type="button" onClick={doGoogle} disabled={busy}
          className="w-full py-3.5 rounded-2xl text-sm font-black text-white disabled:opacity-50 mb-2"
          style={{ background: ACCENT }}
        >
          Googleでログインして復元
        </button>

        <button
          type="button" onClick={() => { setShowEmail((v) => !v); setMsg(null); }}
          className="w-full py-2 text-[11px] font-bold text-gray-400 hover:text-gray-600 mb-1"
        >
          メールで連携していた方はこちら {showEmail ? '▲' : '▼'}
        </button>
        {showEmail && (
          <div className="flex gap-2 mb-2">
            <input
              type="email" inputMode="email" placeholder="メールアドレス" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#AB47BC]"
            />
            <button
              type="button" onClick={doEmail} disabled={busy || !email.trim()}
              className="px-4 py-2.5 rounded-xl text-xs font-black text-white disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              送信
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-[10px] font-bold text-gray-300">または</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <button
          type="button" onClick={doFreshStart} disabled={busy}
          className="w-full py-3.5 rounded-2xl text-sm font-black text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          はじめての方はこちら（新しく始める）
        </button>
        <p className="text-[10px] text-gray-400 leading-snug text-center mt-3">
          新しく始めた後でも、プロフィール画面からいつでもログインできます。
        </p>

        {msg && <p className="text-[11px] text-gray-600 mt-4 leading-snug text-center">{msg}</p>}
      </div>
    </div>
  );
}
