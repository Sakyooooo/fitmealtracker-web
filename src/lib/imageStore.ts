'use client';

const DB_NAME = 'fitmealtracker-images';
const DB_VERSION = 1;
const STORE_NAME = 'images';

type StoredImage = {
  id: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
};

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'));
  }

  return openImageDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  }));
}

export async function saveImage(file: File): Promise<string> {
  const id = crypto.randomUUID();
  const image: StoredImage = {
    id,
    blob: file,
    mimeType: file.type || 'image/jpeg',
    createdAt: new Date().toISOString(),
  };

  await transaction('readwrite', (store) => store.put(image));
  return id;
}

export async function getImageObjectUrl(id: string): Promise<string | null> {
  const image = await transaction<StoredImage | undefined>(
    'readonly',
    (store) => store.get(id),
  );

  return image ? URL.createObjectURL(image.blob) : null;
}

export async function deleteImage(id: string): Promise<void> {
  await transaction('readwrite', (store) => store.delete(id));
}

// ── バックアップ用（ID を保持したまま取り出し / 復元する） ─────────────────────
export type StoredImageRecord = StoredImage;

export async function getStoredImage(id: string): Promise<StoredImageRecord | null> {
  const image = await transaction<StoredImage | undefined>(
    'readonly',
    (store) => store.get(id),
  );
  return image ?? null;
}

/** 復元用: 既存の id をそのまま使って保存する（meals の photoId 参照を維持） */
export async function importImage(image: StoredImageRecord): Promise<void> {
  await transaction('readwrite', (store) => store.put(image));
}
