'use client';

import Modal from '@/components/ui/Modal';
import AddFriendInput from './AddFriendInput';

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (code: string) => Promise<void>;
  error: string | null;
  onClearError: () => void;
};

export default function AddFriendModal({ open, onClose, onAdd, error, onClearError }: Props) {
  async function handleAdd(code: string) {
    await onAdd(code);
    // エラーがなければ閉じる（エラー時はモーダルを開けたまま）
    if (!error) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="フレンドを追加">
      <p className="text-xs text-gray-400 mb-5 leading-relaxed">
        友達のフレンドコードを入力してください。<br />
        相手が承認するとフレンドになれます。
      </p>
      <AddFriendInput onAdd={handleAdd} error={error} onClearError={onClearError} />
    </Modal>
  );
}
