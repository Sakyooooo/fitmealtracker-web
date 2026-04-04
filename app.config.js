/**
 * app.config.js — Expo dynamic config
 *
 * このファイルは app.json を拡張します。
 *
 * ── Claude API について ────────────────────────────────────────────────────────
 * APIキーをクライアントアプリに含めてはいけません。
 * 本番運用では以下の構成を推奨します:
 *
 *   1. バックエンドプロキシサーバーを立てる（例: Express / Fastify / Hono）
 *   2. サーバー側で ANTHROPIC_API_KEY を保持し Claude API を呼ぶ
 *   3. アプリは自分のサーバーエンドポイントだけを叩く
 *   4. サーバー URL を環境変数 EXPO_PUBLIC_API_BASE_URL で指定する
 *
 * services/photo.ts の analyzeMealPhoto() を参照してください。
 * ─────────────────────────────────────────────────────────────────────────────
 */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    // バックエンドプロキシの URL (例: https://your-server.com/api)
    // .env に EXPO_PUBLIC_API_BASE_URL=https://... を設定してください
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  },
});
