'use client';

import { TimelineItem, ReactionEmoji } from '@/lib/types';

const EMOJIS: ReactionEmoji[] = ['💪', '🔥', '👍', '🎉'];

type Props = {
  item: TimelineItem;
  onReact: (item: TimelineItem, emoji: ReactionEmoji) => void;
  isMe?: boolean;
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  const hr = Math.floor(diff / 3_600_000);
  const day = Math.floor(diff / 86_400_000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  if (hr < 24) return `${hr}時間前`;
  return `${day}日前`;
}

function reactionCount(item: TimelineItem, emoji: ReactionEmoji): number {
  return item.reactions.filter((r) => r.emoji === emoji).length;
}

// 写真が無いときの背景（種別ごとのグラデ＋絵文字）
function Placeholder({ isMeal }: { isMeal: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: isMeal
          ? 'linear-gradient(135deg, #7BC96F, #4CAF50)'
          : 'linear-gradient(135deg, #FFB37B, #FF7043)',
      }}
    >
      <span className="text-[88px] opacity-90 select-none drop-shadow">
        {isMeal ? '🍽️' : '🏃'}
      </span>
    </div>
  );
}

export default function TimelineCard({ item, onReact, isMe }: Props) {
  const name = isMe ? 'You' : (item.display_name ?? item.friend_code);
  const initial = name.charAt(0).toUpperCase();
  const isMeal = item.type === 'meal';

  return (
    <article className="mb-4 rounded-3xl overflow-hidden bg-white shadow-sm border border-gray-100">
      {/* ── 写真（強調） ── */}
      <div className="relative w-full aspect-[4/3] bg-gray-100">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrl} alt={item.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <Placeholder isMeal={isMeal} />
        )}

        {/* 上：ユーザー情報 */}
        <div className="absolute top-0 inset-x-0 flex items-center gap-2 p-3
                        bg-gradient-to-b from-black/45 to-transparent">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white/60 overflow-hidden"
            style={{ background: '#AB47BC' }}>
            {item.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-black text-white">{initial}</span>
            )}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-black text-white drop-shadow">{name}</p>
            <p className="text-[10px] font-bold text-white/80">{formatTimeAgo(item.created_at)}</p>
          </div>
          <span className={`ml-auto text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full backdrop-blur
            ${isMeal ? 'bg-white/85 text-[#2e7d32]' : 'bg-white/85 text-[#e64a19]'}`}>
            {isMeal ? '🍽 食事' : '🏋️ 運動'}
          </span>
        </div>

        {/* 下：タイトル＋カロリー */}
        <div className="absolute bottom-0 inset-x-0 p-3 pt-8 bg-gradient-to-t from-black/65 to-transparent">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-black text-white drop-shadow truncate">{item.name}</p>
              {isMeal && item.category && (
                <span className="text-[11px] font-bold text-white/85">{item.category}</span>
              )}
              {!isMeal && item.duration_minutes != null && (
                <span className="text-[11px] font-bold text-white/85">{item.duration_minutes}分</span>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-black text-white leading-none drop-shadow tabular-nums">
                {item.calories.toLocaleString()}
              </p>
              <p className="text-[10px] font-bold text-white/80 tracking-wide">
                {isMeal ? 'KCAL' : 'KCAL 消費'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 下部：栄養・ノート・リアクション ── */}
      <div className="px-3.5 py-2.5">
        {isMeal && (item.protein != null || item.fat != null || item.carbs != null) && (
          <p className="text-[11px] font-bold text-gray-400 mb-1">
            P:{item.protein ?? '—'}g · F:{item.fat ?? '—'}g · C:{item.carbs ?? '—'}g
          </p>
        )}
        {item.note && (
          <p className="text-xs text-gray-500 leading-snug mb-2 line-clamp-2">{item.note}</p>
        )}
        <div className="flex items-center gap-1.5">
          {EMOJIS.map((emoji) => {
            const count = reactionCount(item, emoji);
            const mine = item.my_reaction === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(item, emoji)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold
                            transition-all active:scale-95 ${
                  mine
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
    </article>
  );
}
