'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { AVATAR_CLIPS, CLIP_LABELS, AvatarClip } from '@/components/avatar/clips';

const AvatarViewer = dynamic(() => import('@/components/avatar/AvatarViewer'), { ssr: false });

export default function AvatarPage() {
  const [clip, setClip] = useState<AvatarClip>('Idle');

  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">AVATAR</h1>
        <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mt-1">
          Fitness Avatar Viewer
        </p>
      </div>

      <div className="bg-gradient-to-b from-gray-50 to-white mx-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <AvatarViewer clip={clip} className="w-full h-[440px]" />
      </div>

      {/* Animation selector */}
      <div className="px-4 py-4">
        <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">
          Animation
        </p>
        <div className="grid grid-cols-3 gap-2">
          {AVATAR_CLIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setClip(c)}
              className={`py-2.5 text-xs font-black rounded-xl transition-colors ${
                clip === c
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {CLIP_LABELS[c]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-300 font-bold mt-3 tracking-wide">
          ドラッグで回転 / ピンチでズーム
        </p>
      </div>
    </div>
  );
}
