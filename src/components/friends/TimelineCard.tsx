'use client';

import { useState } from 'react';
import { TimelineItem, ReactionEmoji } from '@/lib/types';
import PhotoLightbox from './PhotoLightbox';

const EMOJIS: ReactionEmoji[] = ['💪', '🔥', '👍', '🎉'];
const ACCENT = '#AB47BC';

type Props = {
  item: TimelineItem;
  onReact: (item: TimelineItem, emoji: ReactionEmoji) => void;
  onAddComment: (item: TimelineItem, body: string) => void;
  onDeleteComment: (item: TimelineItem, commentId: string) => void;
  /** タグ付けされた食事を自分の記録としてシェアする */
  onShare?: (item: TimelineItem) => void;
  /** 現在のユーザーID（自分のコメント削除の判定用） */
  meId: string;
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

export default function TimelineCard({ item, onReact, onAddComment, onDeleteComment, onShare, meId, isMe }: Props) {
  const name = isMe ? 'You' : (item.display_name ?? item.friend_code);
  const initial = name.charAt(0).toUpperCase();
  const isMeal = item.type === 'meal';
  // 自分がタグ付けされた他人の食事投稿には「自分の記録にシェア」ボタンを出す
  const canShare = isMeal && !isMe && !!item.taggedMe && !!onShare;

  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // 投稿時に決めた画角（未指定は中央＝従来と同じ見え方）。カードは 4:3 に切り抜くため、
  // 全体を見たいときは写真をタップして全画面表示する。
  const focusX = item.photoFocusX ?? 50;
  const focusY = item.photoFocusY ?? 50;

  function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    onAddComment(item, text);
    setCommentText('');
  }

  return (
    <article className="mb-4 rounded-3xl overflow-hidden bg-white shadow-sm border border-gray-100">
      {/* ── 写真（強調） ── */}
      <div className="relative w-full aspect-[4/3] bg-gray-100">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photoUrl}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: `${focusX}% ${focusY}%` }}
          />
        ) : (
          <Placeholder isMeal={isMeal} />
        )}

        {/* 写真タップで全画面（写真の全体を見る）。上下のオーバーレイは
            pointer-events-none にしてタップがこのボタンへ抜けるようにしている。 */}
        {item.photoUrl && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="写真を全画面で見る"
            className="absolute inset-0 w-full h-full"
          />
        )}

        {/* 上：ユーザー情報 */}
        <div className="absolute top-0 inset-x-0 flex items-center gap-2 p-3 pointer-events-none
                        bg-gradient-to-b from-black/45 to-transparent">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white/60 overflow-hidden"
            style={{ background: ACCENT }}>
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
        <div className="absolute bottom-0 inset-x-0 p-3 pt-8 pointer-events-none bg-gradient-to-t from-black/65 to-transparent">
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

        {/* タップで全画面になることを示すヒント */}
        {item.photoUrl && (
          <span className="absolute top-14 right-3 w-7 h-7 rounded-full bg-black/40 backdrop-blur
                           flex items-center justify-center pointer-events-none">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </span>
        )}
      </div>

      {/* ── 下部：栄養・ノート・リアクション・コメント ── */}
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

          {/* コメント数トグル */}
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all active:scale-95"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            {item.comments.length > 0 && <span className="tabular-nums">{item.comments.length}</span>}
          </button>
        </div>

        {/* ── タグ付けされた食事：自分の記録にシェア ── */}
        {canShare && (
          <div className="mt-2.5 flex items-center gap-2 rounded-2xl bg-[#F3E8FF] px-3 py-2">
            <span className="text-xs font-bold text-[#8E24AA] leading-snug flex-1">
              📌 {name}さんがあなたをタグ付けしました
            </span>
            {item.alreadyShared ? (
              <span className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-black text-[#8E24AA] bg-white/70 flex items-center gap-1">
                ✓ シェア済み
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onShare?.(item)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-black text-white transition-all active:scale-95"
                style={{ background: ACCENT }}
              >
                自分の記録にシェア
              </button>
            )}
          </div>
        )}

        {/* ── コメント欄 ── */}
        {(showComments || item.comments.length > 0) && (
          <div className="mt-2.5 border-t border-gray-50 pt-2.5">
            {item.comments.length > 0 && (
              <div className="space-y-2 mb-2">
                {item.comments.map((c) => {
                  const mineComment = c.from_user_id === meId;
                  const cname = mineComment ? 'You' : (c.display_name ?? 'フレンド');
                  const cinitial = (c.display_name ?? cname).charAt(0).toUpperCase();
                  return (
                    <div key={c.id} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5"
                        style={{ background: ACCENT }}>
                        {c.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-black text-white">{cinitial}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 bg-gray-50 rounded-2xl px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-black text-gray-700 truncate">{cname}</span>
                          <span className="text-[9px] font-bold text-gray-300 flex-shrink-0">{formatTimeAgo(c.created_at)}</span>
                          {mineComment && (
                            <button
                              type="button"
                              onClick={() => onDeleteComment(item, c.id)}
                              className="ml-auto text-gray-300 hover:text-red-400 text-sm leading-none flex-shrink-0"
                              aria-label="コメントを削除"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 leading-snug break-words whitespace-pre-wrap">{c.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <form onSubmit={submitComment} className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="コメントを追加…"
                maxLength={500}
                className="flex-1 min-w-0 bg-gray-100 rounded-full px-3.5 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#AB47BC]/30"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black text-white transition-all active:scale-95 disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                送信
              </button>
            </form>
          </div>
        )}
      </div>

      <PhotoLightbox
        src={lightboxOpen ? (item.photoUrl ?? null) : null}
        alt={item.name}
        onClose={() => setLightboxOpen(false)}
      />
    </article>
  );
}
