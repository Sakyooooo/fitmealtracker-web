# 02. デザインシステム（トークン）

このファイルが色・文字・余白の **唯一の真実（MASTER）** です。
画面固有の例外を作るときは、必ずその PR の説明に理由を書くこと。

設計方針は coss ui / HeroUI に倣い **「意味論トークン（役割名）で持ち、CSS 変数を Tailwind から参照する」**。
`bg-[#4CAF50]` のような直値をコンポーネントに書かない。

---

## 1. カラー

### 1.1 ドメインアクセント

FitMealTracker は機能ごとに色が割り当てられている。これは維持する（ユーザーの学習が効いているため）。

| 役割 | トークン | 装飾用 | テキスト / 塗り用（白背景 4.5:1 以上） |
|---|---|---|---|
| 食事 | `accent-meal` | `#4CAF50` | **`#2E7D32`** |
| 運動 | `accent-exercise` | `#FF7043` | **`#BF360C`** |
| 体重 | `accent-weight` | `#42A5F5` | **`#1565C0`** |
| プロフィール / 友達 | `accent-profile` | `#AB47BC` | `#AB47BC`（そのまま可） |
| レシピ | `accent-recipe` | `#FF9800` | **`#B45309`** |

### 1.2 コントラスト実測（白 `#FFFFFF` 背景・sRGB 相対輝度による計算値）

| 色 | 対白コントラスト | 小さいテキスト 4.5:1 | 大きいテキスト / アイコン 3:1 |
|---|---|---|---|
| `#4CAF50` | 約 2.8:1 | ✗ | ✗ |
| `#FF7043` | 約 2.7:1 | ✗ | ✗ |
| `#42A5F5` | 約 2.6:1 | ✗ | ✗ |
| `#FF9800` | 約 2.2:1 | ✗ | ✗ |
| `#AB47BC` | 約 4.8:1 | ✓ | ✓ |
| `#2E7D32` | 約 5.2:1 | ✓ | ✓ |
| `#BF360C` | 約 5.6:1 | ✓ | ✓ |
| `#1565C0` | 約 5.7:1 | ✓ | ✓ |
| `#B45309` | 約 5.0:1 | ✓ | ✓ |

**運用ルール**

- **面（塗り）で大きく使う・ボーダー装飾・グラフの系列色** → 装飾用の明るい方でよい
- **テキスト色・アイコン単体・「白文字を載せる塗り」** → テキスト用の濃い方を使う
  - `bg-[#4CAF50] text-white` の CTA は白文字とのコントラストが約 2.8:1 で基準未達。
    塗りを `#2E7D32` にすると 5.2:1 になり、見た目のトーンもほぼ変わらない
- **色だけで意味を伝えない。**PFC バーやカテゴリバッジは、色 + ラベル（P / F / C、「朝食」など）を必ず併記する

### 1.3 ニュートラル / サーフェス

| 役割 | トークン | 値 | 用途 |
|---|---|---|---|
| 背景 | `bg-app` | `#F5F5F5` | body 全体 |
| 面 | `surface` | `#FFFFFF` | カード / モーダル / 入力欄 |
| 面（沈む） | `surface-sunken` | `gray-50` `#F9FAFB` | セグメント背景、非活性エリア |
| 罫線（強） | `border` | `gray-200` `#E5E7EB` | 入力欄の枠、区切り |
| 罫線（弱） | `border-subtle` | `gray-100` `#F3F4F6` | カード内の仕切り、ヘッダ下線 |
| 本文 | `text` | `gray-900` `#111827` | 主要な数値・見出し |
| 副文 | `text-muted` | `gray-500` `#6B7280` | 補足、単位、日時 |
| 微弱 | `text-faint` | `gray-400` `#9CA3AF` | メタ情報。**これより薄い色を本文に使わない** |
| 反転面 | `surface-inverse` | `#0A0A0A` | デスクトップのサイドナビ |

> `text-gray-300` は白背景で約 1.9:1。現在ナビの非アクティブラベルなどに使われているが、
> **テキストには使わない**（非アクティブでも最低 3:1 を確保する。`gray-400` 以上を使う）。

### 1.4 セマンティック

| 役割 | 値 | 用途 |
|---|---|---|
| `success` | `#2E7D32` | 保存成功、目標達成 |
| `warning` | `#B45309` | 上限接近、未入力の注意 |
| `danger` | `#C62828` | 削除、取り消せない操作 |
| `info` | `#1565C0` | 補足の案内、同期状態 |

### 1.5 ダークモード

**現時点では非対応（意図的）。**`dark:` の使用は 1 箇所のみ。
中途半端な対応は色の破綻を招くので、やるなら「全トークンを CSS 変数化 → `:root` と `.dark` で差し替え」を
一括でやる。それまで `dark:` を新規に足さないこと。

---

## 2. タイポグラフィ

### 2.1 フォント

| 用途 | フォント | 備考 |
|---|---|---|
| 本文 UI | システムフォント（Tailwind 既定） | 日本語の可読性重視 |
| 演出画面の本文 | `Zen Maru Gothic` | Daily Recap など「読ませる」画面のみ |
| 数値 | `Outfit` | 大きく見せるカロリー / 体重 / スコア |

`layout.tsx` で Google Fonts を全ページ読み込み済み。**新しいフォントを追加しない。**
数値には `tabular-nums` を併用して桁揺れを防ぐ（既に一部で使用中）。

### 2.2 スケール

| トークン | サイズ | Tailwind | 用途 |
|---|---|---|---|
| `display` | 32px | `text-3xl` | Recap のスコアなど、1 画面に 1 つだけ |
| `title` | 24px | `text-2xl` | 画面のメイン数値（今日の合計 kcal など） |
| `heading` | 18px | `text-lg` | セクション見出し |
| `subheading` | 16px | `text-base` | モーダルタイトル、CTA ラベル |
| `body` | 14px | `text-sm` | 本文・リスト項目・入力値（**既定**） |
| `caption` | 12px | `text-xs` | 補足、単位、日時 |
| `meta` | 11px | `text-[11px]` | ラベル・バッジ。**最小サイズ** |

**`text-[10px]` / `text-[9px]` / `text-[8px]` を新規に使わない。**
日本語は 10px 以下で急激に判読性が落ちる。既存箇所は 07-audit-backlog.md の課題として扱う。
どうしても情報密度が必要なら、文字を縮めるのではなく **情報を削る / 折りたたむ**。

### 2.3 ウェイト

| 用途 | ウェイト |
|---|---|
| 数値の強調 | `font-black` (900) |
| 見出し・ラベル・CTA | `font-bold` (700) |
| 本文 | `font-medium` (500) / 既定 |

`font-semibold` と `font-bold` を同じ役割で混在させない（現状 20:31 で混在）。**`font-bold` に寄せる。**

### 2.4 行間・字間

- 日本語の本文: `leading-relaxed`（1.625）〜 `leading-normal`
- 大きな数値: `leading-none`
- 全角の見出しに `tracking-tight` を使わない（字詰めが詰まりすぎる）。`tracking-tight` は英数字ラベル限定
- 英字の小さいラベル（`KCAL` など）は `tracking-wide` + `uppercase`

---

## 3. 余白（スペーシング）

**4px グリッド。**Tailwind の既定スケールをそのまま使う。

| トークン | 値 | 用途 |
|---|---|---|
| `space-1` | 4px | アイコンとラベルの間 |
| `space-2` | 8px | 密なリスト内の要素間 |
| `space-3` | 12px | カード内の要素間 |
| `space-4` | 16px | カードのパディング、セクション内の間隔 |
| `space-5` | 20px | モーダルのパディング |
| `space-6` | 24px | セクション間 |
| `space-8` | 32px | 画面ブロック間 |

- **画面左右のガター: 16px（`px-4`）で統一。**
- 半端値（`py-3.5` / `py-2.5` / `px-2.5`）は使ってよいが、**同じ役割の要素では揃える**。
  ボタンの高さがカードごとに 1px ずれるのが一番安っぽく見える。

---

## 4. 角丸（Radius）

| トークン | 値 | Tailwind | 用途 |
|---|---|---|---|
| `radius-sm` | 8px | `rounded-lg` | サムネイル、小さいバッジ |
| `radius-md` | 12px | `rounded-xl` | **既定**。カード、入力欄、ボタン |
| `radius-lg` | 16px | `rounded-2xl` | モーダル、大きめのブロック、主要 CTA |
| `radius-xl` | 24px | `rounded-3xl` | ヒーロー的なカード（多用しない） |
| `radius-full` | ∞ | `rounded-full` | チップ、アバター、円形アイコンボタン |

ボトムシートは上だけ `rounded-t-2xl`、デスクトップの中央モーダルは全周 `rounded-2xl`（現行 `Modal.tsx` の実装が正）。

---

## 5. 影（Elevation）

| レベル | Tailwind | 用途 |
|---|---|---|
| 0 | なし | 背景に溶けるブロック |
| 1 | `shadow-sm` | **既定のカード。**リスト項目 |
| 2 | `shadow-md` | 浮いている要素（FAB、ドロップダウン） |
| 3 | `shadow-xl` | モーダル / ボトムシート |

影で階層を作りすぎない。カードの区別は **影より余白と罫線**で行う。

---

## 6. レイアウト

### 6.1 ブレークポイント

チェックすべき幅は ui-ux-pro-max のチェックリストに合わせて **375 / 768 / 1024 / 1440px**。

| 幅 | 想定 | ナビゲーション |
|---|---|---|
| < 768px | スマホ（主要ターゲット・PWA） | 下部タブバー |
| ≥ 768px (`md`) | タブレット / デスクトップ | 左サイドナビ（`w-52` = 208px、`#0A0A0A`） |

### 6.2 コンテンツ幅

- モバイル: 全幅 − 左右 16px
- コンテンツの最大幅: `max-w-2xl`（672px）。デスクトップではサイドナビ分オフセットして中央寄せ

### 6.3 セーフエリア（PWA 必須）

`viewport-fit=cover` を設定済み。**画面端に固定する要素は必ず `env(safe-area-inset-*)` を足す。**

```tsx
style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
```

対象: 下部ナビ、ボトムシート、全画面オーバーレイ、下端固定の CTA。

### 6.4 スクロール領域

- ページ本体の下端には **下部ナビの高さ + safe-area 分のパディング**を確保する（最後の項目が隠れない）
- モーダル本文は `max-h-[80vh] overflow-y-auto`、ヘッダは `sticky top-0`（現行 `Modal.tsx` が正）

---

## 7. トークンを実装に落とす（推奨形）

現在は `globals.css` の CSS 変数と `tailwind.config.ts` の色と、コンポーネント内の直値 `#4CAF50`（77 箇所）が
三重管理になっている。coss ui の型に寄せて一本化する。

```css
/* globals.css */
:root {
  /* domain accents */
  --accent-meal:            #4CAF50;
  --accent-meal-strong:     #2E7D32;
  --accent-exercise:        #FF7043;
  --accent-exercise-strong: #BF360C;
  --accent-weight:          #42A5F5;
  --accent-weight-strong:   #1565C0;
  --accent-profile:         #AB47BC;
  --accent-recipe:          #FF9800;
  --accent-recipe-strong:   #B45309;

  /* surfaces */
  --bg-app:  #F5F5F5;
  --surface: #FFFFFF;

  /* motion (04-motion.md) */
  --dur-fast: 150ms;
  --dur-base: 200ms;
  --dur-slow: 300ms;
  --ease-standard:   cubic-bezier(0.2, 0, 0, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0, 1);
  --ease-accelerate: cubic-bezier(0.3, 0, 1, 1);
}
```

```ts
// tailwind.config.ts
colors: {
  meal:            'var(--accent-meal)',
  'meal-strong':   'var(--accent-meal-strong)',
  exercise:        'var(--accent-exercise)',
  'exercise-strong': 'var(--accent-exercise-strong)',
  weight:          'var(--accent-weight)',
  'weight-strong': 'var(--accent-weight-strong)',
  profile:         'var(--accent-profile)',
  recipe:          'var(--accent-recipe)',
  'recipe-strong': 'var(--accent-recipe-strong)',
},
```

これで `bg-meal` / `text-meal-strong` と書ける。**新規実装では直値の hex を書かないこと。**
既存 77 箇所の置換は 07-audit-backlog.md 参照（段階的に実施）。
