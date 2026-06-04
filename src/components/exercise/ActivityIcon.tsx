'use client';

interface Props {
  name: string;
  size?: number;
  /** CSSスプライトでは色変更不可のため、選択状態は親で枠線制御する */
  color?: string;
}

// 元画像: 1024 × 765 px、4列 × 3行グリッド
// 各セル: 約 256 × 255 px
const SRC_CELL_W = 256;

// 種目 → [col, row]
const SPRITE_MAP: Record<string, [number, number]> = {
  'ベンチプレス':          [0, 0],
  'デッドリフト':          [1, 0],
  'スクワット':            [2, 0],
  'ランニング':            [3, 0],
  'クランチ':              [0, 1],
  'レッグプレス':          [1, 1],
  'プルアップ':            [2, 1],
  'バイセップカール':      [3, 1],
  'ダンベルフライ':        [0, 2],
  'プランク':              [1, 2],
  'トライセップディップ':  [2, 2],
  'ランジ':                [3, 2],
};

export default function ActivityIcon({ name, size = 64 }: Props) {
  const pos = SPRITE_MAP[name];

  if (!pos) {
    return (
      <div
        style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        aria-label={name}
      >
        <span style={{ fontSize: size * 0.45 }}>🏋️</span>
      </div>
    );
  }

  const [col, row] = pos;
  const scale = size / SRC_CELL_W;

  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        backgroundImage: 'url(/exercises.jpg.webp)',
        backgroundSize: `${Math.round(1024 * scale)}px ${Math.round(765 * scale)}px`,
        backgroundPosition: `${-col * size}px ${Math.round(-row * 255 * scale)}px`,
        backgroundRepeat: 'no-repeat',
        flexShrink: 0,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    />
  );
}
