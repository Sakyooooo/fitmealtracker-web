import { ImageResponse } from 'next/og';

// iOS「ホーム画面に追加」用アイコン（180×180 PNG）
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  const weight = { background: '#fff', borderRadius: 7, margin: '0 2px' } as const;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ ...weight, width: 14, height: 44 }} />
          <div style={{ ...weight, width: 17, height: 64 }} />
          <div style={{ background: '#fff', borderRadius: 8, width: 74, height: 16 }} />
          <div style={{ ...weight, width: 17, height: 64 }} />
          <div style={{ ...weight, width: 14, height: 44 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
