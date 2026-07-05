'use client';

import { useState, useCallback, useRef } from 'react';
import { TimelineItem, ReactionEmoji, Comment } from '@/lib/types';
import {
  fetchTimeline, upsertReaction, deleteReaction,
  addComment as sbAddComment, deleteComment as sbDeleteComment,
} from '@/lib/supabaseRepository';
import { supabaseEnabled } from '@/lib/supabase';

/** コメント投稿者（楽観的表示用） */
export type CommentAuthor = { id: string; name: string | null; avatarUrl?: string | null };

type UseTimelineReturn = {
  items: TimelineItem[];
  loading: boolean;
  error: string | null;
  load: (friendIds: string[], myUserId: string) => Promise<void>;
  react: (item: TimelineItem, emoji: ReactionEmoji) => Promise<void>;
  addComment: (item: TimelineItem, body: string, author: CommentAuthor) => Promise<void>;
  deleteComment: (item: TimelineItem, commentId: string) => Promise<void>;
  /** 食事シェア後、その投稿を「シェア済み」表示にする（楽観的更新） */
  markShared: (itemId: string) => void;
};

export function useTimeline(): UseTimelineReturn {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const myIdRef = useRef('');

  const load = useCallback(async (friendIds: string[], myUserId: string) => {
    if (!supabaseEnabled || friendIds.length === 0) return;
    myIdRef.current = myUserId;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTimeline(friendIds, myUserId);
      setItems(data);
    } catch {
      setError('タイムラインの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  const react = useCallback(async (item: TimelineItem, emoji: ReactionEmoji) => {
    const meId = myIdRef.current;
    const alreadySame = item.my_reaction === emoji;

    // 楽観的更新（自分のリアクションは1投稿1件。既存の自分の分を入れ替える）
    setItems((prev) => prev.map((it) => {
      if (it.id !== item.id) return it;
      const withoutMine = it.reactions.filter((r) => r.from_user_id !== meId);
      if (alreadySame) {
        // 同じ絵文字→取り消し
        return { ...it, my_reaction: null, reactions: withoutMine };
      }
      return {
        ...it,
        my_reaction: emoji,
        reactions: [
          ...withoutMine,
          { id: 'optimistic', from_user_id: meId, record_id: it.id, record_type: it.type, emoji, created_at: new Date().toISOString() },
        ],
      };
    }));

    // Supabase に反映（from_user_id は auth.uid() をリポジトリ側で解決）
    if (alreadySame) {
      await deleteReaction(item.id);
    } else {
      await upsertReaction(item.id, item.type, emoji);
    }
  }, []);

  const addComment = useCallback(async (item: TimelineItem, body: string, author: CommentAuthor) => {
    const text = body.trim();
    if (!text) return;
    const tempId = `optimistic-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      from_user_id: author.id,
      record_id: item.id,
      record_type: item.type,
      body: text,
      created_at: new Date().toISOString(),
      display_name: author.name,
      avatar_url: author.avatarUrl ?? null,
    };

    // 楽観的に追加
    setItems((prev) => prev.map((it) =>
      it.id === item.id ? { ...it, comments: [...it.comments, optimistic] } : it,
    ));

    const saved = await sbAddComment(item.id, item.type, text);
    setItems((prev) => prev.map((it) => {
      if (it.id !== item.id) return it;
      if (saved) {
        // 仮IDを実データに置き換え（表示名/アバターは取得値を優先、無ければ楽観値）
        return {
          ...it,
          comments: it.comments.map((c) => (c.id === tempId
            ? { ...saved, display_name: saved.display_name ?? author.name, avatar_url: saved.avatar_url ?? author.avatarUrl ?? null }
            : c)),
        };
      }
      // 失敗時は楽観コメントを取り除く
      return { ...it, comments: it.comments.filter((c) => c.id !== tempId) };
    }));
  }, []);

  const deleteComment = useCallback(async (item: TimelineItem, commentId: string) => {
    setItems((prev) => prev.map((it) =>
      it.id === item.id ? { ...it, comments: it.comments.filter((c) => c.id !== commentId) } : it,
    ));
    await sbDeleteComment(commentId);
  }, []);

  const markShared = useCallback((itemId: string) => {
    setItems((prev) => prev.map((it) =>
      it.id === itemId ? { ...it, alreadyShared: true } : it,
    ));
  }, []);

  return { items, loading, error, load, react, addComment, deleteComment, markShared };
}
