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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-5xl mb-4 select-none">👥</span>
          <p className="text-sm font-bold text-gray-400 tracking-wide">
            まだフレンドがいません
          </p>
          <p className="text-xs text-gray-300 mt-1">
            上のフォームからフレンドコードを入力して追加しましょう
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 space-y-6">

      {/* ── 受信した申請 ── */}
      {pendingReceived.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">
            申請が届いています（{pendingReceived.length}件）
          </p>
          <div className="space-y-2">
            {pendingReceived.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-sm font-bold text-gray-900">{displayName(f.friend)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{f.friend.friend_code}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onAccept(f.id)}
                    className="px-4 py-2 bg-[#4CAF50] text-white text-xs font-bold rounded-xl"
                  >
                    承認
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(f.id)}
                    className="px-4 py-2 bg-gray-100 text-gray-500 text-xs font-bold rounded-xl"
                  >
                    拒否
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="h-px bg-gray-100 mt-2" />
        </section>
      )}

      {/* ── 送信した申請 ── */}
      {pendingSent.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">
            申請中（{pendingSent.length}件）
          </p>
          <div className="space-y-2">
            {pendingSent.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-sm font-bold text-gray-900">{displayName(f.friend)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{f.friend.friend_code}</p>
                </div>
                <span className="text-xs font-bold text-amber-500 bg-amber-50 px-3 py-1.5 rounded-full">
                  承認待ち
                </span>
              </div>
            ))}
          </div>
          <div className="h-px bg-gray-100 mt-2" />
        </section>
      )}

      {/* ── フレンド一覧 ── */}
      {friends.length > 0 && (
        <section>
          <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">
            フレンド（{friends.length}人）
          </p>
          <div className="space-y-2">
            {friends.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-3">
                  {/* アバター（イニシャル） */}
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-gray-500">
                      {displayName(f.friend).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{displayName(f.friend)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{f.friend.friend_code}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`${displayName(f.friend)} をフレンドから削除しますか？`)) {
                      onRemove(f.id);
                    }
                  }}
                  className="text-gray-200 hover:text-red-400 transition-colors text-lg px-1"
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
