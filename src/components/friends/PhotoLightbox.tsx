'use client';

/**
 * 写真の全画面ビューア。
 *
 * タイムラインのカードは写真を 4:3 に切り抜いて表示するため、縦長写真などは
 * 一部しか見えない。写真をタップするとここで原本を全体表示する（object-contain）。
 */

import { useEffect } from 'react';

type Props = {
  src: string | null;
  alt?: string;
  onClose: () => void;
};

export default function PhotoLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    if (!src) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt ?? '写真'}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ''}
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        className="absolute w-10 h-10 rounded-full bg-white/15 text-white text-2xl leading-none flex items-center justify-center backdrop-blur active:scale-95"
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
        }}
      >
        ×
      </button>
    </div>
  );
}
