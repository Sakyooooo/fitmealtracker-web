'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFriends } from '@/hooks/useFriends';
import { useTimeline } from '@/hooks/useTimeline';
import { ReactionEmoji, TimelineItem } from '@/lib/types';
import AddFriendModal from '@/components/friends/AddFriendModal';
import NicknameModal from '@/components/friends/NicknameModal';
import TimelineCard from '@/components/friends/TimelineCard';
import PersonRecordsModal from '@/components/friends/PersonRecordsModal';
import FriendsGlobe, { GlobeUser } from '@/components/friends/FriendsGlobe';
import { loadSettings } from '@/lib/localRepository';
import {
  DEMO_FRIENDS_ENABLED,
  DEMO_GLOBE_USERS,
  DEMO_TIMELINE,
  DEMO_PREFIX,
} from '@/lib/demoFriends';

const ACCENT = '#AB47BC';
const minHeight = 'calc(100svh - 130px)';

// ── 友達アバター（フィルター用） ──────────────────────────────────────────────
function AvatarBubble({
  name,
  isMe,
  active,
  avatarUrl,
  onClick,
}: {
  name: string;
  isMe?: boolean;
  active?: boolean;
  avatarUrl?: string;
  onClick?: () => void;
}) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 flex-shrink-0"
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center transition-all overflow-hidden"
        style={{
          background: isMe ? ACCENT : '#F3E8FF',
          boxShadow: active ? `0 0 0 2.5px ${ACCENT}` : 'none',
          opacity: active === false ? 0.5 : 1,
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-black" style={{ color: isMe ? '#fff' : ACCENT }}>
            {initial}
          </span>
        )}
      </div>
      <span
        className="text-[10px] font-bold tracking-wide"
        style={{ color: active ? ACCENT : '#9CA3AF' }}
      >
        {isMe ? 'You' : name.length > 5 ? name.slice(0, 5) + '…' : name}
      </span>
    </button>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────
export default function FriendsPage() {
  const router = useRouter();
  const {
    enabled, loading, connectionError,
    userId, friendCode, displayName,
    friends,
    error,
    addFriend, updateNickname, clearError,
  } = useFriends();

  const { items: timeline, loading: tlLoading, load: loadTimeline, react } = useTimeline();

  const [tab, setTab] = useState<'timeline' | 'globe'>('timeline');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null); // null = 全体
  const [showConnect, setShowConnect] = useState(false);
  const [showNickname, setShowNickname] = useState(false);
  const [modalUser, setModalUser] = useState<GlobeUser | null>(null); // 像タップで開く記録ポップアップ
  // テスト用ダミー投稿（Supabase 非依存・リアクションはローカルで処理）
  const [demoItems, setDemoItems] = useState<TimelineItem[]>(
    DEMO_FRIENDS_ENABLED ? DEMO_TIMELINE : [],
  );
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | undefined>(undefined);


  // 自分のプロフィール画像（ローカル設定）を読み込む
  useEffect(() => { setMyAvatarUrl(loadSettings().avatarUrl); }, []);

  // QRディープリンク（/friends?add=CODE）で即フレンド追加
  useEffect(() => {
    if (!userId) return;
    const add = new URLSearchParams(window.location.search).get('add');
    if (add && /^FMT-[A-Z0-9]{4}$/i.test(add)) {
      addFriend(add.toUpperCase()).finally(() => {
        window.history.replaceState(null, '', '/friends');
      });
    }
  }, [userId, addFriend]);

  // 自分の投稿も含めてタイムライン取得
  useEffect(() => {
    if (userId) {
      const friendIds = [userId, ...friends.map((f) => f.friend.id)];
      loadTimeline(friendIds, userId);
    }
  }, [userId, friends, loadTimeline]);

  const myDisplayName = displayName ?? friendCode ?? 'You';

  // 各ユーザーの最終記録時刻（球カード表示用）
  const lastActivityByUser = useMemo(() => {
    const map = new Map<string, string>();
    const all = DEMO_FRIENDS_ENABLED ? [...demoItems, ...timeline] : timeline;
    for (const it of all) {
      const prev = map.get(it.user_id);
      if (!prev || new Date(it.created_at).getTime() > new Date(prev).getTime()) {
        map.set(it.user_id, it.created_at);
      }
    }
    return map;
  }, [demoItems, timeline]);

  // フィルター・球で使う「自分＋友達」リスト
  const people: GlobeUser[] = useMemo(() => {
    const meId = userId ?? '__me__';
    const list: GlobeUser[] = [
      { id: meId, name: myDisplayName, isMe: true, lastActivityAt: lastActivityByUser.get(meId), avatarUrl: myAvatarUrl },
    ];
    for (const f of friends) {
      list.push({
        id: f.friend.id,
        name: f.friend.display_name ?? f.friend.friend_code,
        isMe: false,
        lastActivityAt: lastActivityByUser.get(f.friend.id),
        avatarUrl: f.friend.avatar_url ?? undefined,
      });
    }
    if (DEMO_FRIENDS_ENABLED) {
      for (const d of DEMO_GLOBE_USERS) {
        list.push({ ...d, lastActivityAt: lastActivityByUser.get(d.id) });
      }
    }
    return list;
  }, [userId, myDisplayName, friends, lastActivityByUser, myAvatarUrl]);

  // デモ投稿 + 実データを時系列でマージ
  const mergedTimeline = useMemo(() => {
    const base = DEMO_FRIENDS_ENABLED ? [...demoItems, ...timeline] : timeline;
    return [...base].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [demoItems, timeline]);

  // タイムライン絞り込み
  const shownTimeline = useMemo(() => {
    if (!selectedUserId) return mergedTimeline;
    return mergedTimeline.filter((it) => it.user_id === selectedUserId);
  }, [mergedTimeline, selectedUserId]);

  const selectedPerson = people.find((p) => p.id === selectedUserId) ?? null;

  // リアクション: デモ投稿はローカル更新、実投稿は Supabase 経由
  const handleReact = useCallback((item: TimelineItem, emoji: ReactionEmoji) => {
    if (item.id.startsWith(DEMO_PREFIX)) {
      setDemoItems((prev) => prev.map((it) => {
        if (it.id !== item.id) return it;
        const already = it.my_reaction === emoji;
        if (already) {
          return {
            ...it,
            my_reaction: null,
            reactions: it.reactions.filter(
              (r) => !(r.from_user_id === '__me__' && r.emoji === emoji),
            ),
          };
        }
        return {
          ...it,
          my_reaction: emoji,
          reactions: [
            ...it.reactions.filter((r) => r.from_user_id !== '__me__'),
            {
              id: `${DEMO_PREFIX}me`, from_user_id: '__me__', record_id: it.id,
              record_type: it.type, emoji, created_at: new Date().toISOString(),
            },
          ],
        };
      }));
      return;
    }
    react(item, emoji);
  }, [react]);

  // 像タップ: その人の記録をポップアップ表示（自分・フレンド共通）
  const handleSelectUser = useCallback((u: GlobeUser) => {
    setModalUser(u);
  }, []);

  // モーダルに渡す、選択ユーザーの記録一覧
  const modalItems = useMemo(
    () => (modalUser ? mergedTimeline.filter((it) => it.user_id === modalUser.id) : []),
    [modalUser, mergedTimeline],
  );

  function toggleSelect(id: string) {
    setSelectedUserId((prev) => (prev === id ? null : id));
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
        <button type="button" onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl">再接続する</button>
      </div>
    </div>
  );

  if (!userId || !friendCode) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center px-6">
        <span className="text-4xl block mb-3">⚠️</span>
        <p className="text-sm text-gray-500 mb-4">初期化に失敗しました。</p>
        <button type="button" onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl">再読み込み</button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-white">
      <div className="relative z-10 flex flex-col" style={{ minHeight }}>

        {/* ── ヘッダー ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-2">
          {/* 自分のプロフィールへ */}
          <button type="button" onClick={() => router.push('/profile')}
            className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ background: ACCENT }}>
              {myAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={myAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-base font-black text-white">
                  {myDisplayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-sm font-black text-gray-900 truncate">
                {displayName ?? <span className="text-gray-400 font-medium text-xs">プロフィール</span>}
              </p>
              <span className="text-[10px] font-bold tracking-widest" style={{ color: ACCENT }}>
                {friendCode}
              </span>
            </div>
          </button>

          {/* Timeline / フレンドとの世界 トグル */}
          <div className="flex items-center bg-gray-100 rounded-full p-1 gap-0.5 flex-shrink-0">
            {([['timeline', 'Timeline'], ['globe', '🌏 World']] as const).map(([t, label]) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className="px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide transition-all whitespace-nowrap"
                style={tab === t
                  ? { background: '#fff', color: '#111', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                  : { color: '#9CA3AF' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── フレンドアバターストリップ（Timeline タブのフィルター） ── */}
        {tab === 'timeline' && (
        <>
        <div className="px-4 pb-3">
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
            {people.map((p) => (
              <AvatarBubble
                key={p.id}
                name={p.name}
                isMe={p.isMe}
                avatarUrl={p.avatarUrl}
                active={selectedUserId === null ? undefined : selectedUserId === p.id}
                onClick={() => toggleSelect(p.id)}
              />
            ))}
            {/* CONNECT */}
            <button type="button" onClick={() => setShowConnect(true)}
              className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
              <span className="text-[10px] font-bold text-gray-300 tracking-wide">追加</span>
            </button>
          </div>
        </div>

        <div className="h-px bg-gray-100 mx-4 mb-3" />
        </>
        )}

        {/* ── コンテンツ ── */}
        {tab === 'timeline' ? (
          <div ref={timelineScrollRef} className="flex-1 overflow-y-auto">
            {/* 選択中ラベル */}
            {selectedPerson && (
              <div className="px-4 mb-2 flex items-center gap-2">
                <span className="text-sm font-black text-gray-900">
                  {selectedPerson.isMe ? 'You' : selectedPerson.name} のタイムライン
                </span>
                <button type="button" onClick={() => setSelectedUserId(null)}
                  className="text-xs font-bold text-gray-400 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gray-100">
                  全体に戻す ×
                </button>
              </div>
            )}

            {/* タイムライン */}
            <div className="px-4">
              {tlLoading ? (
                <p className="text-center py-12 text-xs font-bold text-gray-300 tracking-widest">LOADING...</p>
              ) : shownTimeline.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-4xl mb-3">🏃</span>
                  <p className="text-sm font-bold text-gray-400">
                    {selectedPerson ? 'まだ投稿がありません' : 'まだ投稿がありません'}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">食事・運動を記録すると<br />ここに表示されます</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-end mb-1">
                    <button type="button"
                      onClick={() => loadTimeline([userId, ...friends.map((f) => f.friend.id)], userId)}
                      className="text-xs font-bold text-gray-400 flex items-center gap-1 hover:text-gray-600 py-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                      </svg>
                      更新
                    </button>
                  </div>
                  {shownTimeline.map((item) => (
                    <TimelineCard
                      key={item.id}
                      item={item}
                      onReact={handleReact}
                      isMe={item.user_id === userId}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          /* ─ フレンドとの世界（地球儀タブ） ─ */
          <div className="flex-1 flex flex-col px-4 pb-4 min-h-0">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <p className="text-xs font-black text-gray-400 tracking-widest uppercase">フレンドとの世界</p>
              <span className="text-[10px] font-bold text-gray-300 tracking-widest">像をタップで記録</span>
            </div>
            {/* 上スペーサー（下スペーサーより大きく＝重心を中央より少し下へ） */}
            <div className="flex-[5] min-h-0" />
            <div className="h-[560px] flex-shrink-0 rounded-3xl overflow-hidden shadow-sm">
              <FriendsGlobe users={people} onSelectUser={handleSelectUser} />
            </div>
            <p className="text-center text-[11px] text-gray-300 font-bold mt-3 flex-shrink-0">
              ドラッグで回転・像をタップで記録を表示
            </p>
            <div className="flex-[1] min-h-0" />
          </div>
        )}
      </div>

      {/* モーダル */}
      <AddFriendModal
        open={showConnect}
        onClose={() => { setShowConnect(false); clearError(); }}
        onAdd={addFriend}
        error={error}
        onClearError={clearError}
        myCode={friendCode}
      />
      <NicknameModal
        open={showNickname}
        onClose={() => setShowNickname(false)}
        current={displayName}
        onSave={updateNickname}
      />

      {/* 像タップ: その人の記録ポップアップ */}
      <PersonRecordsModal
        open={modalUser !== null}
        onClose={() => setModalUser(null)}
        name={modalUser?.name ?? ''}
        isMe={modalUser?.isMe ?? false}
        color={ACCENT}
        avatarUrl={modalUser?.avatarUrl}
        items={modalItems}
      />
    </div>
  );
}
