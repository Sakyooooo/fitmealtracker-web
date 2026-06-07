'use client';

import { Friendship } from '@/lib/types';

type Props = {
  friends: Friendship[];
  pendingReceived: Friendship[];
  pendingSent: Friendship[];
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

function displayName(f: Friendship['friend']): string {
  return f.display_name ?? f.friend_code;
}

export default function FriendList({
  friends, pendingReceived, pendingSent, onAccept, onReject, onRemove,
}: Props) {
  const isEmpty = friends.length === 0 && pendingReceived.length === 0 && pendingSent.length === 0;

  if (isEmpty) {
    return (
      <div className="px-4 pb-8">
        <p className="text-center py-8 text-xs font-bold text-gray-300 tracking-widest">
          NO FRIENDS YET
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 space-y-5">

      {/* ── 受信した申請 ── */}
      {pendingReceived.length > 0 && (
        <section>
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-3">
            申請が届いています（{pendingReceived.length}件）
          </p>
          <div className="space-y-1">
            {pendingReceived.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#AB47BC]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-black text-[#AB47BC]">
                      {displayName(f.friend).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{displayName(f.friend)}</p>
                    <p className="text-[10px] font-bold text-gray-400 tracking-wide">{f.friend.friend_code}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onAccept(f.id)}
                    className="px-3 py-1.5 bg-gray-900 text-white text-xs font-black rounded-lg tracking-wide"
                  >
                    承認
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(f.id)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg"
                  >
                    拒否
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="h-px bg-gray-100 mt-3" />
        </section>
      )}

      {/* ── 送信した申請 ── */}
      {pendingSent.length > 0 && (
        <section>
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-3">
            申請中（{pendingSent.length}件）
          </p>
          <div className="space-y-1">
            {pendingSent.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-black text-gray-400">
                      {displayName(f.friend).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{displayName(f.friend)}</p>
                    <p className="text-[10px] font-bold text-gray-400 tracking-wide">{f.friend.friend_code}</p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-2.5 py-1 rounded-full tracking-wide">
                  承認待ち
                </span>
              </div>
            ))}
          </div>
          <div className="h-px bg-gray-100 mt-3" />
        </section>
      )}

      {/* ── フレンド一覧 ── */}
      {friends.length > 0 && (
        <section>
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-3">
            フレンド（{friends.length}人）
          </p>
          <div className="space-y-1">
            {friends.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#AB47BC]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-black text-[#AB47BC]">
                      {displayName(f.friend).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-900">{displayName(f.friend)}</p>
                    <p className="text-[10px] font-bold text-gray-400 tracking-wide">{f.friend.friend_code}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`${displayName(f.friend)} をフレンドから削除しますか？`)) onRemove(f.id);
                  }}
                  className="text-gray-200 hover:text-red-400 transition-colors text-lg px-1 leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
