# FitMealTracker

食事・運動・体重・ジムセッションを記録するローカル完結型の個人用 PWA。

## セットアップ

```bash
cp .env.local.example .env.local
# .env.local を編集して GEMINI_API_KEY を設定
npm install
npm run dev
```

## Vercel デプロイ

環境変数を Vercel の Project Settings に追加:

| 変数名 | 説明 |
|---|---|
| `GEMINI_API_KEY` | Gemini API キー（必須） |
| `ALLOWED_ORIGIN` | 本番 URL（例: `https://your-app.vercel.app`） |

## 主な機能

- **食事タブ** — カメラボタンで撮影 → Gemini 即解析 → フォーム自動補完
- **ジムタブ** — セッションタイマー、消費カロリー記録
- **データタブ** — 週次グラフ、PFC進捗、体重グラフ、カレンダー
- **エクスポート/インポート** — CSV または JSON 形式

## データ保存

- 記録: `localStorage`
- 食事写真: `IndexedDB`
- `GEMINI_API_KEY` はサーバーサイド専用（クライアントに公開しない）
