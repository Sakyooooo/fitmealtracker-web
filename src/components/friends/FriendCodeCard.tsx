'use client';

import { useState, useRef, useEffect } from 'react';

type Props = {
  friendCode: string;
  userId: string;
  displayName: string | null;
  onUpdateNickname: (name: string) => Promise<boolean>;
};

export default function FriendCodeCard({
  friendCode, userId, displayName, onUpdateNickname,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 編集モードに入ったらフォーカス
  useEffect(() => {
    if (editing) {
      setNameInput(displayName ?? '');
      setSaveError('');
      inputRef.current?.focus();
    }
  }, [editing, displayName]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(friendCode);
    } catch {
      const el = document.createElement('input');
      el.value = friendCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    const trimmed = nameInput.trim();
    if (trimmed.length > 20) {
      setSaveError('20文字以内で入力してください');
      return;
    }
    setSaving(true);
    const ok = await onUpdateNickname(trimmed);
    setSaving(false);
    if (ok) {
      setEditing(false);
    } else {
      setSaveError('保存に失敗しました。再度お試しください。');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setEditing(false);
  }

  return (
    <div className="px-4 pt-6 pb-6">

      {/* ── ニックネーム ── */}
      <div className="mb-4">
        {editing ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={nameInput}
                onChange={(e) => { setNameInput(e.target.value); setSaveError(''); }}
                onKeyDown={handleKeyDown}
                maxLength={20}
                placeholder="ニックネームを入力"
                className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-base font-bold
                           text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/40"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl
                           disabled:opacity-40 whitespace-nowrap"
              >
                {saving ? '保存中' : '保存'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-2.5 text-gray-400 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            {saveError && (
              <p className="text-xs text-red-500 font-medium">{saveError}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 group"
          >
            <span className={`text-xl font-black ${displayName ? 'text-gray-900' : 'text-gray-300'}`}>
              {displayName ?? 'ニックネームを設定'}
            </span>
            <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-sm">
              ✏️
            </span>
          </button>
        )}
      </div>

      {/* ── フレンドコード ── */}
      <p className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-3">
        フレンドコード
      </p>
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

      {/* ID（薄く表示） */}
      <p className="text-[10px] text-gray-200 mt-2 font-mono truncate">
        ID: {userId}
      </p>
    </div>
  );
}
