'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Modal from '@/components/ui/Modal';
import AddFriendInput from './AddFriendInput';

const QrScanner = dynamic(() => import('./QrScanner'), { ssr: false });

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (code: string) => Promise<void>;
  error: string | null;
  onClearError: () => void;
  myCode: string | null;
};

export default function AddFriendModal({ open, onClose, onAdd, error, onClearError, myCode }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [copied, setCopied] = useState(false);

  // 自分のQR（中身は friends?add=CODE のディープリンク）を生成
  useEffect(() => {
    if (!open || !myCode) { setQr(null); return; }
    let active = true;
    (async () => {
      const QRCode = (await import('qrcode')).default;
      const link = `${window.location.origin}/friends?add=${myCode}`;
      const url = await QRCode.toDataURL(link, {
        width: 240, margin: 1, color: { dark: '#1F2937', light: '#ffffff' },
      });
      if (active) setQr(url);
    })().catch(() => { if (active) setQr(null); });
    return () => { active = false; };
  }, [open, myCode]);

  useEffect(() => { if (!open) setScanning(false); }, [open]);

  async function handleAdd(code: string) {
    await onAdd(code);
    if (!error) onClose();
  }

  async function handleScanResult(code: string) {
    setScanning(false);
    await handleAdd(code);
  }

  async function copyCode() {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <Modal open={open} onClose={onClose} title="フレンドを追加">
      {scanning ? (
        <QrScanner onResult={handleScanResult} onClose={() => setScanning(false)} />
      ) : (
        <>
          {/* 自分のQR */}
          {myCode && (
            <div className="flex flex-col items-center mb-5">
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-3">自分のQR</p>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="自分のQRコード" className="w-44 h-44 rounded-2xl" />
              ) : (
                <div className="w-44 h-44 rounded-2xl bg-gray-50 animate-pulse" />
              )}
              <button type="button" onClick={copyCode}
                className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 active:scale-95 transition-transform">
                <span className="text-sm font-black tracking-widest text-gray-700">{myCode}</span>
                <span className="text-[10px] font-bold text-gray-400">{copied ? 'コピー済 ✓' : 'コピー'}</span>
              </button>
              <p className="text-[11px] text-gray-400 mt-2">友達にスキャンしてもらうと追加されます</p>
            </div>
          )}

          {/* スキャン */}
          <button type="button" onClick={() => setScanning(true)}
            className="w-full mb-5 py-3 rounded-2xl bg-[#AB47BC]/10 text-[#AB47BC] text-sm font-black
                       flex items-center justify-center gap-2 active:scale-95 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/>
              <rect x="7" y="7" width="10" height="10" rx="1"/>
            </svg>
            QRコードをスキャン
          </button>

          <div className="h-px bg-gray-100 mb-4" />

          {/* コード入力 */}
          <p className="text-xs text-gray-400 mb-1 leading-relaxed">
            またはフレンドコードを入力（入力するとすぐ追加されます）
          </p>
          <AddFriendInput onAdd={handleAdd} error={error} onClearError={onClearError} />
        </>
      )}
    </Modal>
  );
}
