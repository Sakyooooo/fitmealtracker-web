'use client';

import { useState } from 'react';

type Props = {
  friendCode: string;
  userId: string;
};

export default function FriendCodeCard({ friendCode, userId }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // フォールバック: 古いブラウザ
      const el = document.createElement('input');
      el.value = friendCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="px-4 pt-8 pb-6">
      <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-4">
        あなたのフレンドコード
      </p>

      {/* コード表示 */}
      <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-5 py-4">
        <span className="text-2xl font-black text-gray-900 tracking-wider">
          {friendCode}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            copied
              ? 'bg-[#4CAF50] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {copied ? '✓ コピー済み' : 'コピー'}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-3 leading-relaxed">
        このコードを友達に伝えると、友達申請を受け取れます。
      </p>

      {/* デバッグ用 ID（薄く表示） */}
      <p className="text-[10px] text-gray-200 mt-2 font-mono truncate">
        ID: {userId}
      </p>
    </div>
  );
}
