'use client';

import { useFriends } from '@/hooks/useFriends';
import FriendCodeCard from '@/components/friends/FriendCodeCard';
import AddFriendInput from '@/components/friends/AddFriendInput';
import FriendList from '@/components/friends/FriendList';

export default function FriendsPage() {
  const {
    enabled, loading, connectionError,
    userId, friendCode,
    friends, pendingReceived, pendingSent,
    error,
    addFriend, acceptFriend, blockOrReject, removeFriend, clearError,
  } = useFriends();

  // ── Supabase 未設定 ────────────────────────────────────────────────────────
  if (!enabled) {
    return (
      <main className="p-4 pt-8">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-8">友達</h1>
        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
          <span className="text-5xl mb-4 select-none">🔌</span>
          <p className="text-base font-bold text-gray-700 mb-2">Supabase 未接続</p>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            フレンド機能を使うには<br />Supabase の設定が必要です。
          </p>
          <div className="bg-gray-50 rounded-2xl px-5 py-4 text-left w-full max-w-sm">
            <p className="text-xs font-bold text-gray-500 mb-2 tracking-widest uppercase">
              .env.local に追加
            </p>
            <code className="text-xs text-gray-700 leading-relaxed block font-mono break-all">
              NEXT_PUBLIC_SUPABASE_URL=<br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY=
            </code>
          </div>
        </div>
      </main>
    );
  }

  // ── ローディング ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-300 text-sm font-bold tracking-widest">LOADING</p>
      </div>
    );
  }

  // ── Supabase 接続エラー（設定済みだが到達不可） ───────────────────────────
  if (connectionError) {
    return (
      <main className="p-4 pt-8">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-6">友達</h1>
        <div className="flex flex-col items-center justify-center py-10 text-center px-6">
          <span className="text-5xl mb-4 select-none">⚡</span>
          <p className="text-base font-bold text-gray-700 mb-2">
            Supabase に接続できません
          </p>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            以下のいずれかが原因です：
          </p>
          <div className="bg-gray-50 rounded-2xl px-5 py-4 text-left w-full max-w-sm mb-6 space-y-2">
            <p className="text-xs text-gray-600">
              <span className="font-bold">① DBテーブル未作成</span><br />
              <span className="text-gray-400">Supabase の SQL Editor で<br /><code className="font-mono">supabase/migrations/001_friends.sql</code><br />を実行してください</span>
            </p>
            <div className="h-px bg-gray-200" />
            <p className="text-xs text-gray-600">
              <span className="font-bold">② プロジェクトが一時停止中</span><br />
              <span className="text-gray-400">Supabase ダッシュボードで<br />プロジェクトを再起動してください</span>
            </p>
            <div className="h-px bg-gray-200" />
            <p className="text-xs text-gray-600">
              <span className="font-bold">③ 環境変数が間違っている</span><br />
              <span className="text-gray-400">NEXT_PUBLIC_SUPABASE_URL と<br />ANON_KEY を確認してください</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl"
          >
            再接続する
          </button>
        </div>
      </main>
    );
  }

  // ── userId 取得失敗（通常起きない） ───────────────────────────────────────
  if (!userId || !friendCode) {
    return (
      <main className="p-4 pt-8">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-6">友達</h1>
        <div className="text-center py-12 px-6">
          <span className="text-4xl mb-3 block">⚠️</span>
          <p className="text-sm text-gray-500 mb-4">
            初期化に失敗しました。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl"
          >
            再読み込み
          </button>
        </div>
      </main>
    );
  }

  // ── メイン ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white">
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">友達</h1>
        <p className="text-sm text-gray-400 mt-1">
          フレンドコードで友達と繋がろう
        </p>
      </div>

      <div className="h-px bg-gray-100" />
      <FriendCodeCard friendCode={friendCode} userId={userId} />
      <div className="h-px bg-gray-100" />
      <AddFriendInput onAdd={addFriend} error={error} onClearError={clearError} />
      <div className="h-px bg-gray-100" />
      <FriendList
        friends={friends}
        pendingReceived={pendingReceived}
        pendingSent={pendingSent}
        onAccept={acceptFriend}
        onReject={blockOrReject}
        onRemove={removeFriend}
      />
    </main>
  );
}
