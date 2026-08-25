# 03. コンポーネント規約

coss ui の考え方を採用する: **`src/components/ui/` を primitives 層とし、そこにあるものを組み合わせて画面を作る。**
機能ディレクトリ（`meal/` `exercise/` `friends/` …）には「そのドメイン固有の組み立て」だけを置く。

現状 `src/components/ui/` には `Modal.tsx` しかなく、ボタンや入力欄は各所でクラス文字列がコピーされている。
新規実装では下記の契約に従い、足りない primitive は `ui/` に作ってから使うこと。

---

## 0. 共通ルール

- **アイコンは SVG。**絵文字をアイコンとして使わない（既存の `×` テキストも `<svg>` に置き換えていく）
- **押せる要素は `cursor-pointer`**（`<button>` は Tailwind Preflight で `cursor: default` になるため明示が必要）
- **タップ領域は最低 44×44px。**見た目が小さいアイコンボタンは `p-*` かパディングで領域を確保する
- **`focus-visible` リングを必ず持つ。**`focus:outline-none` を単独で書かない（後述）
- **アイコンのみのボタンには `aria-label` を必ず付ける**
- テキストは折り返しても壊れないこと（`truncate` を使うなら `title` 属性か別の場所に全文を出す）

### フォーカスリングの共通形

```
focus-visible:outline-none
focus-visible:ring-2 focus-visible:ring-offset-1
focus-visible:ring-[色]/50
```

現状 `focus:outline-none` だけを書いてリングを付けていない箇所が複数ある（07 参照）。
`outline-none` を書くなら、必ず代わりの可視フォーカスをセットで書く。

---

## 1. Button

| Variant | 見た目 | 用途 |
|---|---|---|
| `primary` | ドメインの `-strong` 塗り + 白文字 | 画面に 1 つの主要アクション（記録する、保存） |
| `secondary` | `bg-gray-100` + `text-gray-900` | 副次アクション（キャンセル、後で） |
| `ghost` | 透明 + `hover:bg-gray-100` | ツールバー、閉じる、アイコンボタン |
| `danger` | `bg-danger` + 白文字 | 削除の確定 |

| Size | 高さ | パディング | 文字 |
|---|---|---|---|
| `sm` | 32px | `px-3 py-1.5` | `text-xs font-bold` |
| `md`（既定） | 40px | `px-4 py-2.5` | `text-sm font-bold` |
| `lg` | 52px | `px-5 py-4` | `text-base font-bold` |

**必須の状態**

| 状態 | 表現 |
|---|---|
| hover | 明度を 1 段落とす（`hover:bg-*-dark`） |
| active | `active:scale-[0.98]`（04-motion.md） |
| focus-visible | リング |
| disabled | `disabled:opacity-50 disabled:cursor-not-allowed`、かつ `disabled` 属性を実際に付ける |
| loading | ラベルを保ったままスピナーを併置し、幅を変えない。二重送信を防ぐ |

**規約**

- 角丸は `rounded-xl`、幅いっぱいの主要 CTA だけ `rounded-2xl`
- 主要 CTA は画面下部・親指の届く位置に置く（モバイル前提）
- **1 画面に `primary` は 1 つ。**

---

## 2. Card

```
bg-white rounded-xl px-4 py-3.5 shadow-sm
```

- ドメインを示すときは左に 3px のアクセントボーダー（`border-l-[3px] border-meal`）。既存 `MealCard` の形が正
- カード内の階層は「主要テキスト `text-sm font-black text-gray-900`」「補足 `text-xs text-gray-400`」の 2 段まで
- カード全体を押せるようにする場合は `<button>` か `<Link>` でラップし、内部に別のボタンを入れ子にしない
  （削除ボタンなどが必要なら、カードは押せなくするか、スワイプアクションに逃がす）

---

## 3. Modal / BottomSheet

`src/components/ui/Modal.tsx` が唯一の実装。**新しいモーダルを自作しない。**

現行の良い点（維持する）:
- モバイルは下から、`md` 以上は中央
- `max-h-[80vh] overflow-y-auto`、ヘッダ `sticky top-0`
- 背景クリックで閉じる、`env(safe-area-inset-bottom)` 対応
- 開いている間 `body` のスクロールを止める

**追加すべき契約（HeroUI / React Aria の仕様に合わせる）**

| 項目 | 要件 |
|---|---|
| ロール | ルートに `role="dialog"` `aria-modal="true"` |
| ラベル | `aria-labelledby` でタイトル要素の id を指す |
| Esc | Esc キーで閉じる |
| 初期フォーカス | 開いたら最初のフォーカス可能要素（または閉じるボタン）へ移す |
| フォーカストラップ | Tab がモーダル外に出ない |
| 復帰 | 閉じたら開く前の要素にフォーカスを戻す |
| 閉じるボタン | `aria-label="閉じる"`、44×44px の領域 |

アニメーションは 04-motion.md の「ボトムシート」「中央モーダル」を参照。

---

## 4. Form / Field

入力欄の基本形は `globals.css` の `.input` クラスに定義済み。ただし現状、各モーダルが独自の
`inputCls` 文字列を持っていて、フォーカス色だけがドメインごとに違う。**Field primitive に集約する。**

**契約**

- すべての入力に **`<label>` を紐付ける**（`htmlFor` / `id`）。プレースホルダをラベル代わりにしない
- 単位は入力欄の外（サフィックス）に置き、値そのものに混ぜない
- 数値入力は `inputMode="decimal"`（モバイルでテンキーが出る）+ `tabular-nums`
- エラーは **入力欄の直下にテキストで**表示し、枠色だけで伝えない。`aria-invalid` と `aria-describedby` を付ける
- フォーカス時はドメインのアクセント色でリング（`focus-visible:ring-2 ring-[accent]/40`）
- 必須項目は「必須」ラベルを明示（`*` だけにしない）

```
w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[accent]/40
placeholder:text-gray-400
```

---

## 5. Chip / Badge / SegmentedControl

- Chip（カテゴリ選択など）: `rounded-full px-3 py-1.5 text-xs font-bold`、選択時は塗り + 白文字
- **チップ群は必ず折り返す（`flex-wrap`）。**横スクロールにする場合は端が切れているのが分かるフェードを付ける
- **バッジの意味を色だけに依存させない**（ui-ux-pro-max の指摘）。「朝食」「達成」などのラベルを必ず併記
- 数が多いときは「+n」で省略し、その「+n」自体を押して展開できるようにする
- SegmentedControl（タブ切替）は `bg-gray-50` の中に白い選択インジケータ。`role="tablist"` / `role="tab"` を付ける

---

## 6. Progress / Meter

PFC バーやカロリー進捗など。

- 高さ 8px、`rounded-full`、トラックは `bg-gray-100`
- **色だけに意味を持たせない。**数値ラベル（`P: 62 / 90g`）を必ず併記する
- 目標超過は色を変えるだけでなく、超過分を別セグメントで表示する
- `role="progressbar"` + `aria-valuenow` / `aria-valuemin` / `aria-valuemax` / `aria-label`
- 伸びるアニメーションは `duration-500 ease-decelerate`（既存 `MealSummaryCard` と同じ）

---

## 7. EmptyState

記録がまだ無い日は必ず通る画面。**「空です」だけで終わらせない。**

構成: アイコン（薄い） → 1 行の説明 → **次の 1 アクション（primary ボタン）**

例: 「まだ今日の食事が記録されていません」→「カメラで記録する」

---

## 8. Loading / Skeleton

| 待ち時間 | 表現 |
|---|---|
| < 300ms | 何も出さない（ちらつきの方が害） |
| 300ms 〜 2s | インラインのスピナー、またはボタンの loading 状態 |
| > 2s（Gemini 解析など） | **スケルトン + 進捗の言葉**（「写真を解析しています…」） |

- スケルトンは実際のレイアウトと同じ形にする（後でガタつかない）
- 解析系は **キャンセル可能**にする。ネットワーク失敗時は再試行ボタンを出す
- `aria-busy` / `aria-live="polite"` で状態を読み上げ可能にする

---

## 9. 確認・通知（window.confirm / alert の置き換え）

現状 `window.confirm` / `alert` が **29 箇所**ある。PWA では OS ダイアログが浮いて見え、
文言のスタイルも制御できず、Safari の PWA では挙動が不安定になることがある。

**方針**

| 種類 | 置き換え先 |
|---|---|
| 削除の確認 | `ConfirmDialog`（`Modal` ベース、danger ボタン） |
| 成功通知 | `Toast`（3 秒で自動消滅、`aria-live="polite"`） |
| エラー | `Toast`（自動で消さない、再試行ボタン付き、`aria-live="assertive"`） |

- **取り消せる操作は確認ダイアログを出さず、Undo 付き Toast にする**（記録の削除はこちらが望ましい）
- 確認ダイアログを出すのは「本当に取り消せないもの」だけ（全データ削除、アカウント解除）

---

## 10. チャート（Recharts）

- **系列色は 02 のドメインアクセント**を使う。Recharts の既定色を使わない
- 軸ラベル・凡例は `text-[11px] text-gray-500`
- グリッド線は `#F3F4F6`、軸線は非表示にして余白で構造を作る
- ツールチップは白背景 + `rounded-xl` + `shadow-md` + `text-xs`。アプリのカードと同じ見た目にする
- **データが 1 点以下のときはチャートを出さず EmptyState**（1 点の折れ線は情報がない）
- 数値は `tabular-nums`、単位は軸ラベルに 1 回だけ
- 色覚多様性: 系列が 3 つ以上のときは色に加えて **線種 / マーカー形状**でも区別する
- `ResponsiveContainer` を使い、固定 px 幅を書かない

---

## 11. ナビゲーション

- モバイル下部タブ 4 つ（食事 / 運動 / 友達 / マイページ）。**5 つを超えない**
- アクティブ判定は `pathname.startsWith()`。アクティブは色 + ウェイトの 2 要素で示す
- **非アクティブのラベルにも最低 3:1 のコントラストを確保する**（現在の `text-gray-300` は不足）
- タブの高さ + `env(safe-area-inset-bottom)` 分をページ下端のパディングとして確保する
- ナビ項目には `aria-current="page"` を付ける
