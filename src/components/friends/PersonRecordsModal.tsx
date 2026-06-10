'use client';

import Modal from '@/components/ui/Modal';
import { TimelineItem } from '@/lib/types';

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  isMe: boolean;
  color: string;
  avatarUrl?: string;
  items: TimelineItem[];
  /** フレンド削除（実在のフレンドのみ。自分・デモには渡さない） */
  onRemove?: () => void;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  const hr = Math.floor(diff / 3_600_000);
  const day = Math.floor(diff / 86_400_000);
  if (min < 1) return 'たった今';
  if (min < 60) return `${min}分前`;
  if (hr < 24) return `${hr}時間前`;
  return `${day}日前`;
}

function Thumb({ item }: { item: TimelineItem }) {
  const isMeal = item.type === 'meal';
  if (item.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.photoUrl} alt={item.name}
        className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
    );
  }
  return (
    <div className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 text-3xl"
      style={{ background: isMeal
        ? 'linear-gradient(135deg,#7BC96F,#4CAF50)'
        : 'linear-gradient(135deg,#FFB37B,#FF7043)' }}>
      {isMeal ? '🍽️' : '🏃'}
    </div>
  );
}

export default function PersonRecordsModal({ open, onClose, name, isMe, color, avatarUrl, items, onRemove }: Props) {
  const displayName = isMe ? 'You' : name;
  const mealCount = items.filter((i) => i.type === 'meal').length;
  const exCount = items.filter((i) => i.type === 'exercise').length;
  const burned = items.filter((i) => i.type === 'exercise').reduce((s, i) => s + i.calories, 0);

  return (
    <Modal open={open} onClose={onClose} title={`${displayName} の記録`}>
      {/* サマリー */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: color }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-black text-white">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex gap-4">
          <div>
            <p className="text-lg font-black text-gray-900 leading-none tabular-nums">{mealCount}</p>
            <p className="text-[10px] font-bold text-gray-400 tracking-wide">食事</p>
          </div>
          <div>
            <p className="text-lg font-black text-gray-900 leading-none tabular-nums">{exCount}</p>
            <p className="text-[10px] font-bold text-gray-400 tracking-wide">運動</p>
          </div>
          <div>
            <p className="text-lg font-black text-[#FF7043] leading-none tabular-nums">{burned.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-gray-400 tracking-wide">消費 KCAL</p>
          </div>
        </div>
      </div>

      {/* 記録一覧 */}
      {items.length === 0 ? (
        <div className="py-10 text-center">
          <span className="text-3xl block mb-2">🗒️</span>
          <p className="text-sm font-bold text-gray-400">まだ記録がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isMeal = item.type === 'meal';
            return (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-2xl bg-gray-50">
                <Thumb item={item} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-gray-900 truncate">{item.name}</p>
                    <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0
                      ${isMeal ? 'bg-[#4CAF50]/10 text-[#4CAF50]' : 'bg-[#FF7043]/10 text-[#FF7043]'}`}>
                      {isMeal ? '食事' : '運動'}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-gray-400 mt-0.5">
                    <span className="text-gray-900 font-black tabular-nums">
                      {item.calories.toLocaleString()}
                    </span>
                    <span className="ml-1">{isMeal ? 'kcal' : 'kcal 消費'}</span>
                    {isMeal && item.category && <span className="ml-2">{item.category}</span>}
                    {!isMeal && item.duration_minutes != null && <span className="ml-2">{item.duration_minutes}分</span>}
                    <span className="ml-2 text-gray-300">{timeAgo(item.created_at)}</span>
                  </p>
                  {item.note && (
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{item.note}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* フレンド削除（実在のフレンドのみ表示） */}
      {!isMe && onRemove && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`${name} をフレンドから削除しますか？\nお互いのタイムラインと地球儀から表示されなくなります。`)) {
              onRemove();
            }
          }}
          className="w-full mt-5 py-3 border border-red-100 text-red-500 text-sm font-bold rounded-xl hover:bg-red-50 transition-colors"
        >
          フレンドを削除
        </button>
      )}
    </Modal>
  );
}
