'use client';

import { useEffect } from 'react';

/**
 * ブラウザにストレージの永続化を要求する（データ保全）。
 * 許可されると localStorage / IndexedDB がストレージ逼迫時の
 * 自動削除（eviction）の対象から外れる。失敗しても害はない。
 */
export default function StoragePersistence() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    navigator.storage
      .persisted()
      .then((already) => (already ? true : navigator.storage.persist()))
      .catch(() => {});
  }, []);
  return null;
}
