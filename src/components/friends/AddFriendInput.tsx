'use client';

import { useState } from 'react';

type Props = {
  onAdd: (code: string) => Promise<void>;
  error: string | null;
  onClearError: () => void;
};

export default function AddFriendInput({ onAdd, error, onClearError }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    try {
      await onAdd(code.trim());
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // 自動フォーマット: 大文字・英数字・ハイフンのみ許可
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    // すでに FMT- が付いていない場合は補完しない（ユーザーが手打ちしやすいように）
    setCode(val);
    if (error) onClearError();
  }

  return (
    <div className="px-4 pb-6">
      <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-4">
        フレンドを追加
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={code}
            onChange={handleChange}
            placeholder="FMT-XXXX"
            maxLength={8}
            className={`w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 text-lg font-bold
                        text-gray-900 tracking-widest placeholder:text-gray-300
                        focus:outline-none focus:ring-2 transition-all
                        ${error
                          ? 'ring-2 ring-red-300 focus:ring-red-400'
                          : 'focus:ring-[#4CAF50]/40'
                        }`}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          {error && (
            <p className="text-xs text-red-500 font-medium mt-2 px-1">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={!code.trim() || loading}
          className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl text-sm
                     tracking-wide transition-all active:scale-95
                     disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? '申請中...' : '申請を送る'}
        </button>
      </form>
    </div>
  );
}
