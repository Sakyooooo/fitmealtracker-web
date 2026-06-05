'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { getOrCreateUserId, syncUserToSupabase } from '@/lib/identity';
import { Friendship, FriendStatus } from '@/lib/types';

type UseFriendsReturn = {
  /** Supabase が有効かどうか */
  enabled: boolean;
  /** 初期化中 */
  loading: boolean;
  /** Supabase 接続エラー（設定済みだが到達不可） */
  connectionError: boolean;
  /** 自分の user_id */
  userId: string | null;
  /** 自分のフレンドコード（例: FMT-7X3K） */
  friendCode: string | null;
  /** 承認済みフレンド一覧 */
  friends: Friendship[];
  /** 受信した申請（pending・自分が receiver） */
  pendingReceived: Friendship[];
  /** 送信した申請（pending・自分が requester） */
  pendingSent: Friendship[];
  /** エラーメッセージ */
  error: string | null;
  /** フレンド申請を送る */
  addFriend: (code: string) => Promise<void>;
  /** 申請を承認する */
  acceptFriend: (friendshipId: string) => Promise<void>;
  /** ブロック / 申請を拒否する */
  blockOrReject: (friendshipId: string) => Promise<void>;
  /** フレンドを削除（accepted → 削除） */
  removeFriend: (friendshipId: string) => Promise<void>;
  /** エラーをクリア */
  clearError: () => void;
};

export function useFriends(): UseFriendsReturn {
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingReceived, setPendingReceived] = useState<Friendship[]>([]);
  const [pendingSent, setPendingSent] = useState<Friendship[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── フレンド一覧取得（useEffect より前に定義） ────────────────────────────
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

    (async () => {
      const uid = getOrCreateUserId();
      setUserId(uid);

      const code = await syncUserToSupabase(uid);
      if (code === null) {
        // Supabase 設定済みだが接続失敗（テーブル未作成 or ネットワークエラー）
        setConnectionError(true);
      } else {
        setFriendCode(code);
        await loadFriendships(uid);
      }
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

    // コードからユーザーを検索
    const { data: target, error: findErr } = await supabase
      .from('users')
      .select('id, friend_code, display_name')
      .eq('friend_code', normalized)
      .maybeSingle();

    if (findErr) { setError('ユーザーの検索に失敗しました'); return; }
    if (!target)  { setError('そのコードのユーザーが見つかりませんでした'); return; }
    if (target.id === userId) { setError('自分自身には申請できません'); return; }

    // 既存の関係をチェック
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

    // 申請送信
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

    const { error: err } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (err) { setError('削除に失敗しました'); return; }
    if (userId) await loadFriendships(userId);
  }, [userId, loadFriendships]);

  return {
    enabled: supabaseEnabled,
    loading,
    connectionError,
    userId,
    friendCode,
    friends,
    pendingReceived,
    pendingSent,
    error,
    addFriend,
    acceptFriend,
    blockOrReject,
    removeFriend,
    clearError: () => setError(null),
  };
}
