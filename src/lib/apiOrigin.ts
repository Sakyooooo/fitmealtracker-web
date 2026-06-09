/**
 * API ルートの同一オリジン判定。
 *
 * 以前は `origin === https://${VERCEL_URL}` で比較していたが、Vercel の VERCEL_URL は
 * 「デプロイ毎の固有URL」であり、ユーザーが実際に訪れる本番エイリアス
 * （例: fitmealtracker-web.vercel.app）とは異なるため、本番で常に 403 になっていた。
 *
 * 対策: Origin の host が リクエストの Host（= 実際に叩かれたドメイン）と一致すれば許可する。
 * これはドメイン/エイリアス/カスタムドメインに依存せず堅牢な「同一オリジン」判定になる。
 * 明示 allowlist（ALLOWED_ORIGIN）や Vercel の各種URLも併せて許可する。
 */
export function isAllowedRequestOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  // 1) 明示 allowlist（環境変数）
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && origin === allowed) return true;

  // 2) 同一オリジン: Origin の host が リクエストの Host と一致（最も堅牢）
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // Vercel は元のホストを x-forwarded-host に入れる。無ければ host。
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (host && originHost === host) return true;

  // 3) Vercel が用意する URL（デプロイ毎URL / 本番ドメイン）
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && origin === `https://${vercelUrl}`) return true;
  const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prodUrl && origin === `https://${prodUrl}`) return true;

  // 4) ローカル開発
  if (process.env.NODE_ENV === 'development') {
    return origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
  }

  return false;
}
