'use client';

import { useEffect, useRef } from 'react';

type Props = {
  onResult: (code: string) => void;
  onClose: () => void;
};

// モーダル内で同時に1つしか存在しないため固定IDで十分
const ELEMENT_ID = 'qr-reader-main';

/** html5-qrcode を使ったカメラQRスキャナ（クライアント専用）。 */
export default function QrScanner({ onResult, onClose }: Props) {
  const doneRef = useRef(false);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const inst = new Html5Qrcode(ELEMENT_ID);
        scanner = inst as unknown as { stop: () => Promise<void>; clear: () => void };
        await inst.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 220 },
          (decoded: string) => {
            if (doneRef.current) return;
            const m = decoded.match(/FMT-[A-Z0-9]{4}/i);
            if (m) {
              doneRef.current = true;
              onResult(m[0].toUpperCase());
            }
          },
          () => {},
        );
      } catch (e) {
        console.error('[QrScanner] start failed:', e);
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.stop().then(() => scanner && scanner.clear()).catch(() => {});
      }
    };
  }, [onResult]);

  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-3">
        友達のQRをスキャン
      </p>
      <div id={ELEMENT_ID} className="w-full max-w-[280px] rounded-2xl overflow-hidden bg-black" />
      <p className="text-[11px] text-gray-400 mt-3 text-center">
        カメラに友達のQRコードをかざしてください
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full py-2.5 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl"
      >
        閉じる
      </button>
    </div>
  );
}
