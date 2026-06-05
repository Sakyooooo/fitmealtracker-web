'use client';

import { useFriends } from '@/hooks/useFriends';
import FriendCodeCard from '@/components/friends/FriendCodeCard';
import AddFriendInput from '@/components/friends/AddFriendInput';
import FriendList from '@/components/friends/FriendList';

export default function FriendsPage() {
  const {
    enabled, loading,
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
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <span className="text-5xl mb-4 select-none">🔌</span>
          <p className="text-base font-bold text-gray-700 mb-2">Supabase 未接続</p>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            フレンド機能を使うには<br />Supabase の設定が必要です。
          </p>
          <div className="bg-gray-50 rounded-2xl px-5 py-4 text-left w-full max-w-sm">
            <p className="text-xs font-bold text-gray-500 mb-2 tracking-widest uppercase">
              .env.local に追加
            </p>
            <code className="text-xs text-gray-700 leading-relaxed block font-mono">
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

  // ── 初期化エラー（コード取得失敗） ────────────────────────────────────────
  if (!userId || !friendCode) {
    return (
      <main className="p-4 pt-8">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 mb-8">友達</h1>
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <span className="text-5xl mb-4 select-none">⚠️</span>
          <p className="text-sm font-bold text-gray-500">
            初期化に失敗しました。<br />ページを再読み込みしてください。
          </p>
        </div>
      </main>
    );
  }

  // ── メイン ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white">
      {/* ヘッダー */}
      <div className="px-4 pt-8 pb-4">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">友達</h1>
        <p className="text-sm text-gray-400 mt-1">
          フレンドコードで友達と繋がろう
        </p>
      </div>

      <div className="h-px bg-gray-100" />

      {/* 自分のコード */}
      <FriendCodeCard friendCode={friendCode} userId={userId} />

      <div className="h-px bg-gray-100" />

      {/* フレンド追加 */}
      <AddFriendInput
        onAdd={addFriend}
        error={error}
        onClearError={clearError}
      />

      <div className="h-px bg-gray-100" />

      {/* フレンド一覧 */}
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
