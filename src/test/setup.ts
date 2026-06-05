import '@testing-library/jest-dom';
import { IDBFactory } from 'fake-indexeddb';

// IndexedDB をフェイク実装で差し替え
Object.defineProperty(globalThis, 'indexedDB', {
  value: new IDBFactory(),
  writable: true,
});

// localStorage をメモリ実装で差し替え
class MemoryStorage implements Storage {
  private store: Record<string, string> = {};
  get length() { return Object.keys(this.store).length; }
  key(index: number) { return Object.keys(this.store)[index] ?? null; }
  getItem(key: string) { return this.store[key] ?? null; }
  setItem(key: string, value: string) { this.store[key] = value; }
  removeItem(key: string) { delete this.store[key]; }
  clear() { this.store = {}; }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
});

// crypto.randomUUID のポリフィル（jsdom では未定義の場合あり）
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    writable: true,
  });
}

// テストごとに localStorage をリセット
beforeEach(() => {
  localStorage.clear();
});
