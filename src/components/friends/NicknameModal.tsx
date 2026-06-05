'use client';

import { useState, useEffect, useRef } from 'react';
import Modal from '@/components/ui/Modal';

type Props = {
  open: boolean;
  onClose: () => void;
  current: string | null;
  onSave: (name: string) => Promise<boolean>;
};

export default function NicknameModal({ open, onClose, current, onSave }: Props) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(current ?? '');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, current]);

  async function handleSave() {
    const trimmed = value.trim();
    if (trimmed.length > 20) { setError('20文字以内で入力してください'); return; }
    setSaving(true);
    const ok = await onSave(trimmed);
    setSaving(false);
    if (ok) onClose();
    else setError('保存に失敗しました。再度お試しください。');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
  }

  return (
    <Modal open={open} onClose={onClose} title="ニックネームを設定">
      <div className="mb-6">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          maxLength={20}
          placeholder="例: たろう"
          className="w-full text-center text-3xl font-black text-gray-900 bg-gray-50
                     border-0 rounded-2xl px-4 py-4 focus:outline-none focus:bg-gray-100"
        />
        {error && <p className="text-xs text-red-500 text-center mt-2 font-medium">{error}</p>}
        <p className="text-xs text-gray-400 text-center mt-2">
          フレンド一覧に表示される名前です
        </p>
      </div>
      <div className="flex gap-2">
        {current && (
          <button
            type="button"
            onClick={() => onSave('')}
            className="px-4 py-3 border border-gray-200 text-gray-400 text-sm font-bold rounded-xl hover:bg-gray-50"
          >
            削除
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 bg-gray-900 text-white text-sm font-black rounded-xl hover:bg-gray-800 disabled:opacity-40"
        >
          {saving ? '保存中...' : '設定する'}
        </button>
      </div>
    </Modal>
  );
}
