'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import {
  getOrCreateUserId,
  syncUserToSupabase,
  cacheFriendCode,
  getCachedFriendCode,
  getCachedDisplayName,
  updateDisplayName,
} from '@/lib/identity';
import { Friendship, FriendStatus } from '@/lib/types';

type UseFriendsReturn = {
  enabled: boolean;
  loading: boolean;
  connectionError: boolean;
  userId: string | null;
  friendCode: string | null;
  displayName: string | null;
  friends: Friendship[];
  pendingReceived: Friendship[];
  pendingSent: Friendship[];
  error: string | null;
  addFriend: (code: string) => Promise<void>;
  acceptFriend: (friendshipId: string) => Promise<void>;
  blockOrReject: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  updateNickname: (name: string) => Promise<boolean>;
  clearError: () => void;
};

export function useFriends(): UseFriendsReturn {
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Friendship[]>([]);
  const [pendingSent, setPendingSent] = useState<Friendship[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── フレンド一覧取得 ──────────────────────────────────────────────────────
  const loadFriendships = useCallback(async (uid: string) => {
    if (!supabase) return;

    const { data, error: err } = await supabase
      .from('friendships')
      .select(`
        id, requester_id, receiver_id, status, created_at,
        requester:users!friendships_requester_id_fkey(id, friend_code, display_name, created_at),
        receiver:users!friendships_receiver_id_fkey(id, friend_code, display_name, created_at)
      `)
      .or(`requester_id.eq.${uid},receiver_id.eq.${uid}`)
      .neq('status', 'blocked');

    if (err) {
      console.error('[useFriends] loadFriendships:', err.message);
      return;
    }

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      requester_id: string;
      receiver_id: string;
      status: FriendStatus;
      created_at: string;
      requester: { id: string; friend_code: string; display_name: string | null; created_at: string };
      receiver:  { id: string; friend_code: string; display_name: string | null; created_at: string };
    }>;

    const toFriendship = (row: typeof rows[0]): Friendship => ({
      id: row.id,
      requester_id: row.requester_id,
      receiver_id: row.receiver_id,
      status: row.status,
      created_at: row.created_at,
      friend: row.requester_id === uid ? row.receiver : row.requester,
    });

    const accepted = rows.filter((r) => r.status === 'accepted').map(toFriendship);
    const pending  = rows.filter((r) => r.status === 'pending');

    setFriends(accepted);
    setPendingReceived(pending.filter((r) => r.receiver_id === uid).map(toFriendship));
    setPendingSent(pending.filter((r) => r.requester_id === uid).map(toFriendship));
  }, []);

  // ── 初期化 ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabaseEnabled) { setLoading(false); return; }

    const uid = getOrCreateUserId();
    setUserId(uid);

    // ① キャッシュから即時表示（ネットワーク不要）
    const cachedCode = getCachedFriendCode();
    const cachedName = getCachedDisplayName();
    if (cachedCode) {
      setFriendCode(cachedCode);
      setLoading(false); // キャッシュがあれば即座にローディング解除
    }
    if (cachedName) setDisplayName(cachedName);

    // ② バックグラウンドで Supabase と同期
    (async () => {
      const code = await syncUserToSupabase(uid);
      if (code === null) {
        if (!cachedCode) {
          // キャッシュもなく接続も失敗 → エラー表示
          setConnectionError(true);
          setLoading(false);
        }
        // キャッシュありなら既に表示済みなのでエラー表示しない
        return;
      }

      // Supabase からコードを取得できた
      setFriendCode(code);
      cacheFriendCode(code); // キャッシュ更新

      // Supabase からニックネームも取得して同期
      const { data: userData } = await supabase!
        .from('users')
        .select('display_name')
        .eq('id', uid)
        .maybeSingle();
      if (userData?.display_name) {
        setDisplayName(userData.display_name as string);
        // キャッシュを最新状態に更新（identity.ts の cacheDisplayName を直接呼ぶ）
        try { localStorage.setItem('fmt_display_name', userData.display_name as string); } catch { /* quota */ }
      }

      await loadFriendships(uid);
      setLoading(false);
    })();
  }, [loadFriendships]);

  // ── フレンド申請 ──────────────────────────────────────────────────────────
  const addFriend = useCallback(async (code: string) => {
    if (!supabase || !userId) return;
    setError(null);

    const normalized = code.trim().toUpperCase();
    if (!/^FMT-[A-Z0-9]{4}$/.test(normalized)) {
      setError('フレンドコードの形式が正しくありません（例: FMT-7X3K）');
      return;
    }

    const { data: target, error: findErr } = await supabase
      .from('users')
      .select('id, friend_code, display_name')
      .eq('friend_code', normalized)
      .maybeSingle();

    if (findErr) { setError('ユーザーの検索に失敗しました'); return; }
    if (!target)  { setError('そのコードのユーザーが見つかりませんでした'); return; }
    if (target.id === userId) { setError('自分自身には申請できません'); return; }

    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(
        `and(requester_id.eq.${userId},receiver_id.eq.${target.id}),` +
        `and(requester_id.eq.${target.id},receiver_id.eq.${userId})`
      )
      .maybeSingle();

    if (existing) {
      const s = (existing as { status: string }).status;
      if (s === 'accepted') { setError('すでにフレンドです'); return; }
      if (s === 'pending')  { setError('すでに申請中です'); return; }
    }

    const { error: insertErr } = await supabase.from('friendships').insert({
      requester_id: userId,
      receiver_id: target.id,
      status: 'pending',
    });

    if (insertErr) { setError('申請の送信に失敗しました'); return; }
    await loadFriendships(userId);
  }, [userId, loadFriendships]);

  // ── 申請承認 ──────────────────────────────────────────────────────────────
  const acceptFriend = useCallback(async (friendshipId: string) => {
    if (!supabase || !userId) return;
    const { error: err } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .eq('receiver_id', userId);
    if (err) { setError('承認に失敗しました'); return; }
    await loadFriendships(userId);
  }, [userId, loadFriendships]);

  // ── ブロック / 拒否 ──────────────────────────────────────────────────────
  const blockOrReject = useCallback(async (friendshipId: string) => {
    if (!supabase || !userId) return;
    const { error: err } = await supabase
      .from('friendships')
      .update({ status: 'blocked' })
      .eq('id', friendshipId);
    if (err) { setError('操作に失敗しました'); return; }
    await loadFriendships(userId);
  }, [userId, loadFriendships]);

  // ── フレンド削除 ──────────────────────────────────────────────────────────
  const removeFriend = useCallback(async (friendshipId: string) => {
    if (!supabase) return;
    const { error: err } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (err) { setError('削除に失敗しました'); return; }
    if (userId) await loadFriendships(userId);
  }, [userId, loadFriendships]);

  // ── ニックネーム更新 ──────────────────────────────────────────────────────
  const updateNickname = useCallback(async (name: string): Promise<boolean> => {
    if (!userId) return false;
    const ok = await updateDisplayName(userId, name);
    if (ok) setDisplayName(name.trim() || null);
    return ok;
  }, [userId]);

  return {
    enabled: supabaseEnabled,
    loading,
    connectionError,
    userId,
    friendCode,
    displayName,
    friends,
    pendingReceived,
    pendingSent,
    error,
    addFriend,
    acceptFriend,
    blockOrReject,
    removeFriend,
    updateNickname,
    clearError: () => setError(null),
  };
}
