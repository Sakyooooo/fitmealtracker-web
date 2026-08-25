# 07. 現状監査と改善バックログ

計測日: 2026-08 / 対象: `src/` 全体。
数値は `grep` による機械的なカウントなので、実際の対応時は各箇所を確認すること。

**このバックログは「全部やる TODO」ではなく、「新規実装のときにその場で直す指針」です。**
触ったファイルの中にある項目から潰していくのが現実的。

---

## 1. サマリ

| 項目 | 現状 | あるべき姿 | 優先度 |
|---|---|---|---|
| `<label htmlFor>` の紐付け | **0 件** / 入力要素 57 個 | 全入力にラベル | **高** |
| `prefers-reduced-motion` | **未対応** | 全体に適用 | **高** |
| `cursor-pointer` | **0 件** / `<button>` 172 個 | 押せる要素すべて | **高** |
| 塗り CTA の白文字コントラスト | 約 2.8:1（未達） | 4.5:1 以上 | **高** |
| `aria-hidden` の装飾 SVG | **0 件** | 装飾 SVG すべて | 中 |
| `focus:outline-none` の代替なし | 7 行 | 0 行 | 中 |
| hex 直値 `#4CAF50` など | 77 + 38 + 31 + … | トークン参照 | 中 |
| `transition-all` | 23 箇所 / 18 ファイル | 0 | 中 |
| `window.confirm` / `alert` | 29 箇所 | Dialog / Toast | 中 |
| `text-[10px]` 以下 | 71 箇所 | 11px 以上 | 低 |
| `text-gray-300` をテキストに使用 | 45 箇所 | `gray-400` 以上 | 低 |
| `font-semibold` と `font-bold` の混在 | 20 / 31 | `font-bold` に統一 | 低 |

---

## 2. 優先度「高」

### H1. フォームのラベルが 1 つも紐付いていない

入力要素 57 個に対して `htmlFor` が 0 件。プレースホルダがラベル代わりになっている。
スクリーンリーダーで何の入力欄か分からず、タップ領域も広がらない。

**対応**: `src/components/ui/Field.tsx` を作り、`label` + `input` + エラー表示をまとめて提供する。
新規のフォームは必ずこれを使い、既存は触るついでに置き換える。
→ 03-components.md §4

### H2. `prefers-reduced-motion` 未対応

該当コードが 1 件もない。`globals.css` に一括の抑制ルールを入れるだけで大部分が解決する。
JS 駆動（Three.js アバター、Daily Recap）は個別に分岐が必要。
→ 04-motion.md §6 にコピペ可能な CSS あり

### H3. `cursor-pointer` が 1 つも無い

Tailwind の Preflight により `<button>` の `cursor` は `default`。172 個のボタンすべてで
「押せそうに見えない」状態。**Button primitive を作れば一括で解決する。**

暫定対応として `globals.css` に以下を入れる手もある（副作用が小さく効果が大きい）:

```css
@layer base {
  button:not(:disabled), [role='button']:not([aria-disabled='true']) {
    cursor: pointer;
  }
}
```

### H4. 主要 CTA のコントラスト未達

`bg-[#4CAF50] text-white`（例: `QuickMealForm.tsx` の記録ボタン、`DetailMealForm.tsx`、
`RecipeDetailModal.tsx`、`RecordRecipesModal.tsx`）は白文字とのコントラストが約 2.8:1。

**対応**: 塗りを `#2E7D32` に変える。運動 `#FF7043` → `#BF360C`、体重 `#42A5F5` → `#1565C0`、
レシピ `#FF9800` → `#B45309` も同様。
→ 02-design-system.md §1.2

---

## 3. 優先度「中」

### M1. 装飾 SVG に `aria-hidden` が無い

`Navigation.tsx` のタブアイコンをはじめ、`aria-hidden="true"` が 0 件。
テキストラベルが隣にある SVG はすべて装飾扱いにする。

### M2. `focus:outline-none` の代替が無い箇所（7 行）

`GymSessionCard.tsx`（5 箇所）ほか。アウトラインを消してリングも枠色変化も付けていないため、
キーボード操作時にフォーカス位置が完全に見えなくなる。
→ 03-components.md §0 の共通フォーカスリング形

### M3. カラートークンの三重管理

`globals.css` の CSS 変数（`--color-meal` 等）、`tailwind.config.ts` の `colors`、
コンポーネント内の直値 hex（`#4CAF50` 77 / `#FF7043` 38 / `#AB47BC` 31 / `#FF9800` 11 / `#42A5F5` 8）が
バラバラに存在している。

**対応**: 02-design-system.md §7 の形（CSS 変数 = 真実、Tailwind はその別名）に一本化。
移行はドメイン単位（meal → exercise → …）で進めると差分が読みやすい。

### M4. `transition-all` 23 箇所

18 ファイルに分散。意図しないプロパティにトランジションが乗り、レイアウト再計算を誘発する。
`transition-colors` / `transition-transform` / `transition-opacity` に置き換える。

### M5. `window.confirm` / `alert` 29 箇所

PWA では OS ダイアログが文脈から浮く。特に **記録の削除は「確認」ではなく「Undo 付き Toast」**にすると
操作が 1 タップ減り、体験も安全になる。
→ 03-components.md §9

### M6. Modal の a11y が不完全

`ui/Modal.tsx` は `aria-modal` が 1 箇所（別ファイル）にあるのみで、
`role="dialog"` / `aria-labelledby` / Esc / フォーカストラップ / フォーカス復帰が未実装。
**Modal は 1 ファイルしかないので、ここを直せば全モーダルが一度に良くなる。投資効率が最も高い。**
→ 03-components.md §3

---

## 4. 優先度「低」（触るついでに）

### L1. 極小フォント 71 箇所

`text-[10px]` 64 / `text-[9px]` 4 / `text-[8px]` 3。日本語の判読性が落ちる。
`text-[11px]` を下限にする。情報量が入らないなら、文字を縮めるのではなく情報を削る。

### L2. `text-gray-300` をテキストに使用 45 箇所

白背景で約 1.9:1。特に `Navigation.tsx` の非アクティブタブラベルは、
「どのタブがあるか」自体が読み取りにくい。`text-gray-400` 以上にする。

### L3. ウェイトの揺れ

`font-semibold` 20 / `font-bold` 31 が同じ役割で混在。`font-bold` に統一。

### L4. `<div onClick>` 1 箇所

数は少ないので、見つけ次第 `<button>` に置き換える。

### L5. Daily Recap のインラインスタイル

`DailyRecap.tsx` / `RecapScoreCard.tsx` が `style={{ font: "..." }}` の直書きで構成されている。
演出画面として独立した見た目を持つのは妥当だが、
**色と余白だけでもトークンを参照する**と、テーマ変更時に取り残されない。

---

## 5. 進め方の提案

1 回の PR で全部やらない。以下の順で切ると差分が小さく、効果が大きい。

| # | 内容 | 影響範囲 | 得られるもの |
|---|---|---|---|
| 1 | `globals.css` に reduced-motion + `cursor: pointer` を追加 | 2 ルール | H2 / H3 が一括解決 |
| 2 | `ui/Modal.tsx` の a11y 強化 | 1 ファイル | 全モーダルが改善（M6） |
| 3 | `ui/Button.tsx` を作り、主要 CTA から置換 | 段階的 | H3 / H4 / ウェイト統一 |
| 4 | `ui/Field.tsx` を作り、モーダルのフォームから置換 | 段階的 | H1 |
| 5 | カラートークン一本化（ドメイン単位） | 段階的 | M3 / H4 の残り |
| 6 | `ConfirmDialog` / `Toast` を作り `window.confirm` を置換 | 段階的 | M5 |

各 PR で 06-checklist.md を通すこと。
