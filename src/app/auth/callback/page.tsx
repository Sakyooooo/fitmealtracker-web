'use client';

/**
 * OAuth / マジックリンクの着地ページ。
 *
 * 1. linkIdentity が「そのGoogleは既存アカウントに紐付き済み」で失敗した場合は
 *    signInWithOAuth へ自動フォールバック（＝既存アカウントへの切り替え）。
 * 2. セッション確立を待ち、uid が変わっていれば mergeAfterSignIn がローカル記録を
 *    引き継ぎ＆クラウドから復元する。
 * 3. 完了後はフルリロードでプロフィールへ（Provider の状態を作り直すため）。
 */

import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { mergeAfterSignIn } from '@/lib/syncMerge';

const RETRY_FLAG = 'fmt_cb_retry';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const [msg, setMsg] = useState('サインインを確認しています…');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode の二重実行防止
    ran.current = true;

    async function run() {
      if (!supabaseEnabled || !supabase) {
        window.location.replace('/profile');
        return;
      }

    // ── OAuth エラーの検知（query / hash 両方に乗り得る） ──
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const errCode = url.searchParams.get('error_code') ?? hashParams.get('error_code');
    const errDesc = url.searchParams.get('error_description') ?? hashParams.get('error_description') ?? '';
    const hasError = !!(errCode || url.searchParams.get('error') || hashParams.get('error'));

    if (hasError) {
      const alreadyLinked = errCode === 'identity_already_exists' || /already linked/i.test(errDesc);
      const retried = sessionStorage.getItem(RETRY_FLAG) === '1';
      if (alreadyLinked && !retried) {
        // このGoogleは既存アカウントのもの → サインインへ自動フォールバック。
        // Google側のセッションが生きていれば追加操作なしで戻ってくる。
        sessionStorage.setItem(RETRY_FLAG, '1');
        setMsg('既存のアカウントに切り替えています…');
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        return; // リダイレクトされる
      }
      sessionStorage.removeItem(RETRY_FLAG);
      setStatus('error');
      setMsg(`サインインに失敗しました: ${decodeURIComponent(errDesc || errCode || '不明なエラー')}`);
      return;
    }
    sessionStorage.removeItem(RETRY_FLAG);

    // ── セッション確立を待つ（detectSessionInUrl の完了待ち） ──
    let uid: string | null = null;
    let anonymous = false;
    for (let i = 0; i < 40; i++) {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (u?.id) {
        uid = u.id;
        anonymous = (u as { is_anonymous?: boolean }).is_anonymous ?? false;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!uid) {
      setStatus('error');
      setMsg('セッションを確認できませんでした。プロフィール画面からもう一度お試しください。');
      return;
    }

    // ── データの引き継ぎ＆同期 ──
    setMsg('記録を同期しています…');
    try {
      const summary = await mergeAfterSignIn(uid, anonymous);
      setMsg(`✅ ${summary}`);
    } catch (err) {
      console.error('[auth/callback] merge:', err);
      setMsg('同期に失敗しました。プロフィールの「今すぐ再同期」をお試しください。');
    }
    setTimeout(() => window.location.replace('/profile'), 1500);
    }

    run();
  }, []);

  return (
    <div className="min-h-[70svh] flex flex-col items-center justify-center px-8 text-center">
      {status === 'working' && (
        <div className="mb-4 w-8 h-8 rounded-full border-4 border-gray-200 border-t-[#AB47BC] animate-spin" />
      )}
      <p className="text-sm font-bold text-gray-700 leading-relaxed whitespace-pre-wrap">{msg}</p>
      {status === 'error' && (
        <a href="/profile" className="mt-6 px-5 py-2.5 rounded-xl text-sm font-black text-white" style={{ background: '#AB47BC' }}>
          プロフィールへ戻る
        </a>
      )}
    </div>
  );
}
