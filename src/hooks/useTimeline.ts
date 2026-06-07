'use client';

import { useState, useCallback } from 'react';
import { TimelineItem, ReactionEmoji } from '@/lib/types';
import { fetchTimeline, upsertReaction, deleteReaction } from '@/lib/supabaseRepository';
import { supabaseEnabled } from '@/lib/supabase';

type UseTimelineReturn = {
  items: TimelineItem[];
  loading: boolean;
  error: string | null;
  load: (friendIds: string[], myUserId: string) => Promise<void>;
  react: (item: TimelineItem, emoji: ReactionEmoji) => Promise<void>;
};

export function useTimeline(): UseTimelineReturn {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (friendIds: string[], myUserId: string) => {
    if (!supabaseEnabled || friendIds.length === 0) return;
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
    const alreadySame = item.my_reaction === emoji;

    // 楽観的更新
    setItems((prev) => prev.map((it) => {
      if (it.id !== item.id) return it;

      const filtered = it.reactions.filter((r) => r.from_user_id !== (it.my_reaction ? 'me' : ''));
      if (alreadySame) {
        // 同じ絵文字→取り消し
        return {
          ...it,
          my_reaction: null,
          reactions: it.reactions.filter((r) => !(r.from_user_id === item.user_id && r.emoji === emoji)),
        };
      }
      return {
        ...it,
        my_reaction: emoji,
        reactions: [
          ...it.reactions.filter((r) => r.from_user_id !== item.user_id),
          { id: 'optimistic', from_user_id: item.user_id, record_id: it.id, record_type: it.type, emoji, created_at: new Date().toISOString() },
        ],
      };
    }));

    // Supabase に反映
    if (alreadySame) {
      await deleteReaction(item.user_id, item.id);
    } else {
      await upsertReaction(item.user_id, item.id, item.type, emoji);
    }
  }, []);

  return { items, loading, error, load, react };
}
