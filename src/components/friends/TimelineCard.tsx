'use client';

import { TimelineItem, ReactionEmoji } from '@/lib/types';

const EMOJIS: ReactionEmoji[] = ['💪', '🔥', '👍', '🎉'];

type Props = {
  item: TimelineItem;
  onReact: (item: TimelineItem, emoji: ReactionEmoji) => void;
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min  = Math.floor(diff / 60_000);
  const hr   = Math.floor(diff / 3_600_000);
  const day  = Math.floor(diff / 86_400_000);
  if (min  < 1)  return 'たった今';
  if (min  < 60) return `${min}分前`;
  if (hr   < 24) return `${hr}時間前`;
  return `${day}日前`;
}

function reactionCount(item: TimelineItem, emoji: ReactionEmoji): number {
  return item.reactions.filter((r) => r.emoji === emoji).length;
}

export default function TimelineCard({ item, onReact }: Props) {
  const name = item.display_name ?? item.friend_code;
  const initial = name.charAt(0).toUpperCase();
  const isMeal = item.type === 'meal';

  return (
    <div className="py-4">
      {/* ── ヘッダー行 ── */}
      <div className="flex items-center gap-3 mb-3">
        {/* アバター */}
        <div className="w-9 h-9 rounded-full bg-[#AB47BC]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-black text-[#AB47BC]">{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-gray-900 truncate">{name}</p>
          <p className="text-[10px] font-bold text-gray-400 tracking-wide">
            {formatTimeAgo(item.created_at)}
          </p>
        </div>
        {/* タイプバッジ */}
        <span className={`text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full ${
          isMeal
            ? 'bg-[#4CAF50]/10 text-[#4CAF50]'
            : 'bg-[#FF7043]/10 text-[#FF7043]'
        }`}>
          {isMeal ? '🍽 食事' : '🏋️ 運動'}
        </span>
      </div>

      {/* ── コンテンツ ── */}
      <div className="ml-12">
        <div className="flex items-baseline gap-2 mb-1">
          <p className="text-base font-black text-gray-900">{item.name}</p>
          {isMeal && item.category && (
            <span className="text-xs text-gray-400">{item.category}</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className="font-black text-gray-900 tabular-nums">
            {isMeal ? item.calories.toLocaleString() : item.calories.toLocaleString()}
            <span className="text-xs font-bold text-gray-400 ml-1">
              {isMeal ? 'kcal' : 'kcal 消費'}
            </span>
          </span>
          {!isMeal && item.duration_minutes != null && (
            <>
              <span className="text-gray-200">·</span>
              <span className="text-gray-500 text-xs font-bold">{item.duration_minutes}分</span>
            </>
          )}
          {isMeal && (item.protein != null || item.fat != null || item.carbs != null) && (
            <span className="text-[10px] text-gray-400">
              P:{item.protein ?? '—'} F:{item.fat ?? '—'} C:{item.carbs ?? '—'}g
            </span>
          )}
        </div>

        {item.note && (
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.note}</p>
        )}

        {/* ── リアクション ── */}
        <div className="flex items-center gap-2 mt-3">
          {EMOJIS.map((emoji) => {
            const count = reactionCount(item, emoji);
            const isMe  = item.my_reaction === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(item, emoji)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold
                            transition-all active:scale-95 ${
                  isMe
                    ? 'bg-[#AB47BC] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{emoji}</span>
                {count > 0 && <span className="tabular-nums">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-px bg-gray-100 mt-4 ml-12" />
    </div>
  );
}
