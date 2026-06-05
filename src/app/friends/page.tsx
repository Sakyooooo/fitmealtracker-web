'use client';

import { useState, useEffect } from 'react';
import { useFriends } from '@/hooks/useFriends';
import { useTimeline } from '@/hooks/useTimeline';
import { HERO_FONT_SIZE } from '@/lib/constants';
import { ReactionEmoji, TimelineItem } from '@/lib/types';
import AddFriendModal from '@/components/friends/AddFriendModal';
import NicknameModal from '@/components/friends/NicknameModal';
import FriendList from '@/components/friends/FriendList';
import TimelineCard from '@/components/friends/TimelineCard';

const ACCENT = '#AB47BC';
const minHeight = 'calc(100svh - 130px)';

export default function FriendsPage() {
  const {
    enabled, loading, connectionError,
    userId, friendCode, displayName,
    friends, pendingReceived, pendingSent,
    error,
    addFriend, acceptFriend, blockOrReject, removeFriend,
    updateNickname, clearError,
  } = useFriends();

  const { items: timeline, loading: tlLoading, load: loadTimeline, react } = useTimeline();

  const [showConnect, setShowConnect] = useState(false);
  const [showNickname, setShowNickname] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [copied, setCopied] = useState(false);

  // フレンドが揃ったらタイムラインを取得
  useEffect(() => {
    if (userId && friends.length > 0) {
      const friendIds = friends.map((f) => f.friend.id);
      loadTimeline(friendIds, userId);
    }
  }, [userId, friends, loadTimeline]);

  async function handleCopy() {
    if (!friendCode) return;
    try { await navigator.clipboard.writeText(friendCode); }
    catch {
      const el = document.createElement('input');
      el.value = friendCode;
      document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  // ── Supabase 未設定 ────────────────────────────────────────────────────────
  if (!enabled) return (
    <div className="flex flex-col" style={{ minHeight }}>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">友達</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl mb-4 select-none">🔌</span>
        <p className="text-base font-bold text-gray-700 mb-2">Supabase 未接続</p>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">フレンド機能を使うには<br />Supabase の設定が必要です。</p>
        <div className="bg-gray-50 rounded-2xl px-5 py-4 text-left w-full max-w-sm">
          <p className="text-xs font-bold text-gray-500 mb-2 tracking-widest uppercase">.env.local に追加</p>
          <code className="text-xs text-gray-700 leading-relaxed block font-mono break-all">
            NEXT_PUBLIC_SUPABASE_URL=<br />NEXT_PUBLIC_SUPABASE_ANON_KEY=
          </code>
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-300 text-sm font-bold tracking-widest">LOADING</p>
    </div>
  );

  if (connectionError) return (
    <div className="flex flex-col" style={{ minHeight }}>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">友達</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <span className="text-5xl mb-4 select-none">⚡</span>
        <p className="text-base font-bold text-gray-700 mb-2">Supabase に接続できません</p>
        <div className="bg-gray-50 rounded-2xl px-5 py-4 text-left w-full max-w-sm mb-6 space-y-2">
          <p className="text-xs text-gray-600"><span className="font-bold">① DBテーブル未作成</span><br /><span className="text-gray-400">002_meals_exercises.sql を実行</span></p>
          <div className="h-px bg-gray-200" />
          <p className="text-xs text-gray-600"><span className="font-bold">② プロジェクト一時停止中</span><br /><span className="text-gray-400">Supabase ダッシュボードで再起動</span></p>
          <div className="h-px bg-gray-200" />
          <p className="text-xs text-gray-600"><span className="font-bold">③ 環境変数が間違っている</span><br /><span className="text-gray-400">URL と ANON_KEY を確認</span></p>
        </div>
        <button type="button" onClick={() => window.location.reload()} className="px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl">再接続する</button>
      </div>
    </div>
  );

  if (!userId || !friendCode) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center px-6">
        <span className="text-4xl block mb-3">⚠️</span>
        <p className="text-sm text-gray-500 mb-4">初期化に失敗しました。</p>
        <button type="button" onClick={() => window.location.reload()} className="px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl">再読み込み</button>
      </div>
    </div>
  );

  const pendingCount = pendingReceived.length;
  const totalList = friends.length + pendingReceived.length + pendingSent.length;

  return (
    <div className="relative min-h-screen bg-white">
      <div className="relative z-10">

        {/* ── ヒーローエリア ── */}
        <div className="flex flex-col" style={{ minHeight }}>
          {/* ヘッダー */}
          <div className="px-4 pt-4 pb-2">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">友達</h1>
            <div className="flex gap-3 mt-1 items-center">
              <button type="button" onClick={() => setShowNickname(true)}
                className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                {displayName
                  ? <span>{displayName}</span>
                  : <span className="text-gray-400">ニックネームを設定</span>}
              </button>
              <span className="text-gray-300">|</span>
              <button type="button" onClick={handleCopy}
                className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: ACCENT }} />
                <span>{copied ? 'コピー済み ✓' : friendCode}</span>
              </button>
            </div>
          </div>

          {/* ビッグ数値 */}
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <p className="font-black italic leading-none tracking-tighter text-gray-900 tabular-nums"
               style={{ fontSize: HERO_FONT_SIZE }}>
              {friends.length}
            </p>
            <div className="w-44 h-[2px] bg-gray-900 mt-3 mb-3" />
            <p className="text-sm font-bold tracking-[0.2em] text-gray-500">FRIENDS</p>
            {pendingCount > 0 && (
              <p className="text-xs font-black mt-2 tracking-widest" style={{ color: ACCENT }}>
                {pendingCount}件の申請が届いています
              </p>
            )}
          </div>

          {/* 3連CTA */}
          <div className="flex flex-col items-center pb-6">
            <div className="flex items-center gap-8">
              {/* ニックネーム編集 */}
              <button type="button" onClick={() => setShowNickname(true)}
                className="w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200
                           flex items-center justify-center hover:bg-white transition-colors shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>

              {/* CONNECT */}
              <button type="button" onClick={() => setShowConnect(true)}
                className="w-28 h-28 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-transform"
                style={{ backgroundColor: ACCENT }}>
                <span className="text-white font-black text-sm tracking-widest">CONNECT</span>
              </button>

              {/* コピー（申請バッジ） */}
              <div className="relative">
                <button type="button" onClick={handleCopy}
                  className="w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200
                             flex items-center justify-center hover:bg-white transition-colors shadow-sm">
                  {copied
                    ? <span className="text-[#4CAF50] font-black text-sm">✓</span>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                      </svg>
                  }
                </button>
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center"
                    style={{ backgroundColor: ACCENT }}>
                    {pendingCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── タイムライン ── */}
        <div className="px-4 pb-2">
          <button type="button" onClick={() => setShowTimeline((v) => !v)}
            className="flex items-center gap-2 text-xs font-black text-gray-400 tracking-widest uppercase">
            <span>{showTimeline ? '▲' : '▼'}</span>
            <span>Timeline</span>
            {timeline.length > 0 && (
              <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-[10px] font-bold">
                {timeline.length}
              </span>
            )}
          </button>
        </div>

        {showTimeline && (
          <div className="px-4">
            {friends.length === 0 ? (
              <p className="text-center py-8 text-xs font-bold text-gray-300 tracking-widest">
                CONNECT A FRIEND TO SEE TIMELINE
              </p>
            ) : tlLoading ? (
              <p className="text-center py-8 text-xs font-bold text-gray-300 tracking-widest">LOADING...</p>
            ) : timeline.length === 0 ? (
              <p className="text-center py-8 text-xs font-bold text-gray-300 tracking-widest">
                NO ACTIVITY YET
              </p>
            ) : (
              <div>
                {/* 更新ボタン */}
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={() => loadTimeline(friends.map((f) => f.friend.id), userId)}
                    className="text-xs font-bold text-gray-400 flex items-center gap-1 hover:text-gray-600"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="23 4 23 10 17 10"/>
                      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                    </svg>
                    更新
                  </button>
                </div>
                {timeline.map((item) => (
                  <TimelineCard
                    key={item.id}
                    item={item}
                    onReact={(it: TimelineItem, emoji: ReactionEmoji) => react(it, emoji)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── フレンドリスト ── */}
        <div className="px-4 pb-2 mt-2">
          <button type="button" onClick={() => setShowList((v) => !v)}
            className="flex items-center gap-2 text-xs font-black text-gray-400 tracking-widest uppercase">
            <span>{showList ? '▲' : '▼'}</span>
            <span>Friend List</span>
            {totalList > 0 && (
              <span className="bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-[10px] font-bold">
                {totalList}
              </span>
            )}
          </button>
        </div>

        {showList && (
          <FriendList
            friends={friends}
            pendingReceived={pendingReceived}
            pendingSent={pendingSent}
            onAccept={acceptFriend}
            onReject={blockOrReject}
            onRemove={removeFriend}
          />
        )}
      </div>

      {/* モーダル */}
      <AddFriendModal
        open={showConnect}
        onClose={() => { setShowConnect(false); clearError(); }}
        onAdd={addFriend}
        error={error}
        onClearError={clearError}
      />
      <NicknameModal
        open={showNickname}
        onClose={() => setShowNickname(false)}
        current={displayName}
        onSave={updateNickname}
      />
    </div>
  );
}
