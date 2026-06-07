'use client';

import dynamic from 'next/dynamic';

export type GlobeUser = {
  id: string;
  name: string;
  isMe: boolean;
  location?: string;
  lastActivityAt?: string; // 最終記録の ISO 時刻（カード表示用）
  avatarUrl?: string;      // プロフィール画像（data URL）
};

const Globe3D = dynamic(() => import('./Globe3D'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="text-xs font-bold text-slate-400 tracking-widest">LOADING…</p>
    </div>
  ),
});

interface Props {
  users: GlobeUser[];
  onSelectUser?: (user: GlobeUser) => void;
}

export default function FriendsGlobe({ users, onSelectUser }: Props) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <Globe3D users={users} onSelectUser={onSelectUser} />
    </div>
  );
}
