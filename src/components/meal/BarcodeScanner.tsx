'use client';

import { useEffect, useRef } from 'react';

type Props = {
  onResult: (barcode: string) => void;
  onClose: () => void;
};

// モーダル内で同時に1つしか存在しないため固定IDで十分
const ELEMENT_ID = 'barcode-reader-main';

/** html5-qrcode を1次元バーコード（JAN/EAN/UPC）用に設定したカメラスキャナ。 */
export default function BarcodeScanner({ onResult, onClose }: Props) {
  const doneRef = useRef(false);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;
        const inst = new Html5Qrcode(ELEMENT_ID, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          verbose: false,
        });
        scanner = inst as unknown as { stop: () => Promise<void>; clear: () => void };
        await inst.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 280, height: 160 } },
          (decoded: string) => {
            if (doneRef.current) return;
            const digits = decoded.replace(/\D/g, '');
            if (digits.length >= 8) {
              doneRef.current = true;
              onResult(digits);
            }
          },
          () => {},
        );
      } catch (e) {
        console.error('[BarcodeScanner] start failed:', e);
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
        商品バーコードをスキャン
      </p>
      <div id={ELEMENT_ID} className="w-full max-w-[300px] rounded-2xl overflow-hidden bg-black" />
      <p className="text-[11px] text-gray-400 mt-3 text-center">
        パッケージのバーコードをカメラにかざしてください
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full py-2.5 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl"
      >
        閉じる
      </button>
    </div>
  );
}
