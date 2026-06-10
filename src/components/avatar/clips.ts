// Fixed clip names baked into /public/models/Avatar.glb (do not rename)
export const AVATAR_CLIPS = [
  'Idle',
  'Walk',
  'Run',
  'Squat',
  'BenchPress',
  'PullUp',
] as const;

export type AvatarClip = (typeof AVATAR_CLIPS)[number];

export const CLIP_LABELS: Record<AvatarClip, string> = {
  Idle: 'アイドル',
  Walk: 'ウォーク',
  Run: 'ラン',
  Squat: 'スクワット',
  BenchPress: 'ベンチプレス',
  PullUp: '懸垂',
};

// equipment nodes inside Avatar.glb shown per clip
export const CLIP_EQUIPMENT: Record<string, string[]> = {
  BenchPress: ['Bench', 'Barbell'],
  Squat: ['Barbell'],
  PullUp: ['PullUpBar'],
};

export const EQUIPMENT_NODES = ['Bench', 'Barbell', 'PullUpBar'] as const;
