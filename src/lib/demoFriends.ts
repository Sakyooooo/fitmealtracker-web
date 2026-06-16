/**
 * デモ用のダミーフレンド & タイムライン投稿（テスト表示専用）
 *
 * Supabase には一切書き込まず、クライアント側で friends ページに合流させる。
 * 既定は無効（本番にダミーを出さない）。テストで表示したいときだけ
 * 環境変数 NEXT_PUBLIC_DEMO_FRIENDS=on を設定する。
 */

import type { GlobeUser } from '@/components/friends/FriendsGlobe';
import type { TimelineItem } from '@/lib/types';

/** テスト用フラグ。既定 OFF。NEXT_PUBLIC_DEMO_FRIENDS=on のときだけ有効。 */
export const DEMO_FRIENDS_ENABLED = process.env.NEXT_PUBLIC_DEMO_FRIENDS === 'on';

/** id プレフィックス（実データと区別し、リアクションをローカル処理するため） */
export const DEMO_PREFIX = 'demo-';

const FRIEND_AOI = `${DEMO_PREFIX}aoi`;
const FRIEND_KEN = `${DEMO_PREFIX}ken`;

/** 〜分前の ISO 文字列 */
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** デモ用のアバター画像（グラデ＋イニシャルの SVG data URL） */
const demoAvatar = (c1: string, c2: string, letter: string) =>
  'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
    `<rect width="80" height="80" fill="url(#g)"/>` +
    `<text x="40" y="53" font-size="44" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text>` +
    `</svg>`,
  );

const AOI_AVATAR = demoAvatar('#F6A6C1', '#EC4899', 'A');
const KEN_AVATAR = demoAvatar('#86EFAC', '#22C55E', 'K');

/** ダミーフレンド2体（地球儀＆フィルター用） */
export const DEMO_GLOBE_USERS: GlobeUser[] = [
  { id: FRIEND_AOI, name: 'Aoi', isMe: false, location: '大阪・日本', avatarUrl: AOI_AVATAR },
  { id: FRIEND_KEN, name: 'Ken', isMe: false, location: 'Seoul・Korea', avatarUrl: KEN_AVATAR },
];

/** ダミー投稿3件 */
export const DEMO_TIMELINE: TimelineItem[] = [
  {
    id: `${DEMO_PREFIX}post-1`,
    type: 'exercise',
    user_id: FRIEND_AOI,
    display_name: 'Aoi',
    friend_code: 'FMT-AOI1',
    avatarUrl: AOI_AVATAR,
    name: 'ランニング',
    calories: 320,
    date: new Date().toISOString().slice(0, 10),
    duration_minutes: 35,
    exercise_type: 'normal',
    note: '朝の河川敷ラン🌅 気持ちよかった！',
    created_at: minutesAgo(42),
    reactions: [
      { id: `${DEMO_PREFIX}r1`, from_user_id: FRIEND_KEN, record_id: `${DEMO_PREFIX}post-1`, record_type: 'exercise', emoji: '🔥', created_at: minutesAgo(30) },
      { id: `${DEMO_PREFIX}r2`, from_user_id: FRIEND_KEN, record_id: `${DEMO_PREFIX}post-1`, record_type: 'exercise', emoji: '💪', created_at: minutesAgo(25) },
    ],
    my_reaction: null,
    comments: [
      { id: `${DEMO_PREFIX}c1`, from_user_id: FRIEND_KEN, record_id: `${DEMO_PREFIX}post-1`, record_type: 'exercise', body: 'ナイスラン！🏃 自分も走ってきます', created_at: minutesAgo(20), display_name: 'Ken', avatar_url: KEN_AVATAR },
    ],
  },
  {
    id: `${DEMO_PREFIX}post-2`,
    type: 'meal',
    user_id: FRIEND_KEN,
    display_name: 'Ken',
    friend_code: 'FMT-KEN2',
    avatarUrl: KEN_AVATAR,
    name: '鶏胸肉サラダ',
    calories: 420,
    date: new Date().toISOString().slice(0, 10),
    category: '昼食',
    protein: 38,
    fat: 12,
    carbs: 24,
    photoUrl: '/demo/salad.svg',
    note: '高タンパク・低脂質ランチ🥗',
    created_at: minutesAgo(150),
    reactions: [
      { id: `${DEMO_PREFIX}r3`, from_user_id: FRIEND_AOI, record_id: `${DEMO_PREFIX}post-2`, record_type: 'meal', emoji: '👍', created_at: minutesAgo(120) },
    ],
    my_reaction: null,
    comments: [
      { id: `${DEMO_PREFIX}c2`, from_user_id: FRIEND_AOI, record_id: `${DEMO_PREFIX}post-2`, record_type: 'meal', body: 'おいしそう！レシピ教えて〜', created_at: minutesAgo(110), display_name: 'Aoi', avatar_url: AOI_AVATAR },
    ],
  },
  {
    id: `${DEMO_PREFIX}post-3`,
    type: 'meal',
    user_id: FRIEND_AOI,
    display_name: 'Aoi',
    friend_code: 'FMT-AOI1',
    avatarUrl: AOI_AVATAR,
    name: 'プロテインスムージー',
    calories: 180,
    date: new Date().toISOString().slice(0, 10),
    category: '間食',
    protein: 22,
    fat: 3,
    carbs: 15,
    photoUrl: '/demo/smoothie.svg',
    note: 'トレ後の一杯💪',
    created_at: minutesAgo(310),
    reactions: [],
    my_reaction: null,
    comments: [],
  },
];
