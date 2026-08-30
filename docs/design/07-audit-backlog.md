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
| 未使用の GLB アセット | 14 個中 12 個が未参照（約 3.3MB） | 削除 | 中 |
| `exercise_avatar.glb` のサイズ | 3.5MB | 500KB 以下 | 中 |
| 3D の `prefers-reduced-motion` 分岐 | **未対応** | 静止ポーズにする | 中 |
| 3D の画面外・非アクティブ時の停止 | **未対応**（`frameloop` 未指定） | `demand` / `never` に切替 | 中 |
| `<Canvas>` の `aria-hidden` | 未設定 | 装飾なら付与 | 低 |
| ジムセッション中の文字（HIG Workouts） | 極小 + 薄色が 13 箇所 | 大きく・高コントラスト | **高** |
| 本文サイズ | `text-sm`(14px) が既定 | `text-base`(16px) | 中 |
| 入力欄の文字サイズ | 一部 14px | 16px 以上（iOS 自動ズーム対策） | 中 |
| バリデーション通知 | `alert()` | 入力欄の直下にインライン表示 | 中 |
| 下部タブバー | 不透明 `bg-white` + `border-t` | 半透明 + `backdrop-blur`（浮いた層） | 低 |

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

## 5. 3D / Three.js（→ 08-3d.md）

対象: `AvatarViewer.tsx` / `ExerciseAvatarStage.tsx` / `GymSessionCard.tsx`。

### 良い状態（維持する）

- `GymSessionCard.tsx` が `dynamic(..., { ssr: false })` で遅延読み込みしている
- `MeshMatcapMaterial` + `vertexColors` でライトを置かず、matcap を Canvas で生成している
  （**テクスチャ資産ゼロ**。ThreeUI のプロシージャル志向と同じ方向）
- 影は `ContactShadows` のみで、シャドウマップを有効にしていない
- 種目名・回数がテキストでも表示されていて、3D にしか無い情報になっていない

### 3D-1. 未使用の GLB が 12 個（優先度: 中）

`public/models/` に GLB が 14 ファイル・合計 **7.2MB** あるが、`src/` から参照されているのは
`Avatar.glb`（356KB）と `exercise_avatar.glb`（3.5MB）の 2 つだけ。

未参照: `chibi_active` / `chibi_avatar` / `chibi_casual` / `chibi_standard` / `chibi_themed` /
`earth_lowpoly` / `earth_lowpoly_mobile` / `earth_textured` / `low_poly_earth` /
`fitness_avatar_complete` / `mannequin_avatar` / `statues`（約 3.3MB）

`public/` の中身はビルド成果物にそのまま入る。**削除するか、`docs/reference/` 相当の場所へ退避する。**
（`earth_*` 系は `types.ts` の「旧 GlobeUser」というコメントから、削除された地球儀機能の残骸と思われる）

### 3D-2. `exercise_avatar.glb` が 3.5MB（優先度: 中）

08-3d.md §3.2 の予算（1 ファイル 500KB 以下）の 7 倍。ジムセッション開始時に毎回これを取りに行く。

**対応**: Draco / meshopt 圧縮をかける。それでも落ちなければ、
`Avatar.glb`（356KB）と同じ作り方に寄せられないかを検討する。

### 3D-3. `prefers-reduced-motion` の分岐が無い（優先度: 中）

CSS の一括抑制（04-motion.md §6）は WebGL のアニメーションループを止められない。
アバターのクリップ再生を JS で分岐し、静止ポーズにする必要がある。
→ 08-3d.md §5 にコピペ可能な実装あり

### 3D-4. 画面外・非アクティブ時に描画が止まらない（優先度: 中）

両方の `<Canvas>` で `frameloop` が未指定のため既定の `'always'`。
スクロールで画面外に出ても、タブが裏に回っても回り続ける。PWA ではバッテリー消費に直結する。

**対応**: `IntersectionObserver` と `document.visibilityState` を見て
`frameloop` を `'always'` / `'never'` で切り替える。→ 08-3d.md §3.4

### 3D-5. `dpr={[1, 2]}` が高い（優先度: 低）

`[1, 1.5]` にすると塗り面積が約 44% 減る。matcap ベースの見た目なので劣化はほぼ分からない。

### 3D-6. `<Canvas>` に `aria-hidden` が無い（優先度: 低）

WebGL の中身はスクリーンリーダーから不可視。
情報がテキストで別途出ている以上、Canvas は装飾扱いにして `aria-hidden="true"` + `tabIndex={-1}` にする。

### 3D-7. WebGL フォールバックが無い（優先度: 低）

`ErrorBoundary` が無いため、WebGL が使えない環境や GLB 取得失敗でクラッシュしうる。
静止画へのフォールバックを用意する。→ 08-3d.md §6

---

## 6. Apple HIG との差分（→ 09-apple-hig.md）

### 良い状態（維持する）

- `ClientLayout.tsx` が下部ナビの高さ + `env(safe-area-inset-bottom)` を
  **コンテンツ側の下パディング**で確保している。HIG の「コントロール層はコンテンツの上に浮く」に沿った実装
- タブが 4 つで、オーバーフロー（「その他」タブ）が発生しない
- PFC を**横バー**で表現している。Activity リングを模していない（HIG が明示的に禁止している）
- Daily Recap がセッション後のサマリーとして機能している（HIG Workouts の推奨）
- `backdrop-blur` を既に 7 箇所で使えている（下部バーへの適用も技術的な障壁はない）

### HIG-1. ジムセッション中の文字が小さく薄い（優先度: **高**）

HIG Workouts は「**動きながら読むことを前提に、大きい文字サイズと高コントラストで、
重要な情報を読みやすく配置する**」と明示している。

`GymSessionCard.tsx` には `text-[10px]` / `text-[11px]` / `text-gray-300` が **13 箇所**ある。
セッション中はまさに「動きながら読む」画面なので、ここが最優先の是正対象。

**対応**: セッション中に表示する数値（セット数、レップ、重量、経過時間）を
`text-base` 以上・`text-gray-900`・`tabular-nums` にする。

### HIG-2. 入力欄の文字が 16px 未満（優先度: 中）

`text-sm`(14px) の入力欄がある。**iOS Safari は 16px 未満の入力欄にフォーカスするとページを自動ズームする。**
記録動線の途中で画面が飛ぶのは体験として大きな損失。

**対応**: `Field` primitive（H1）を作る時点で、入力の文字サイズを `text-base` に固定する。

### HIG-3. バリデーションを `alert()` で伝えている（優先度: 中）

`AddExerciseModal.tsx`（3 箇所）、`AddWeightModal.tsx`、`exercise/page.tsx`、`profile/page.tsx` が
入力検証の失敗を `alert()` で伝えている。

HIG は次の 2 点を言っている:
- 「**情報を伝えるだけのアラートを使わない**」（行動できないアラートは嫌われる）
- 「**入力した瞬間に検証する。**長いフォームを埋めた後で戻らせない」

**対応**: 該当する入力欄の直下にエラーテキストを出し、`aria-invalid` / `aria-describedby` を付ける。
`alert()` は使わない。→ 03-components.md §4

> `ExportButton.tsx` の「復元が完了しました」「インポートが完了しました」は、
> ページ再読み込みを伴う十分に重要な操作なので、確認を出すこと自体は HIG に反しない。
> ただし OS ダイアログではなくアプリ内のダイアログに置き換えるのが望ましい。

### HIG-4. 本文の既定が 14px（優先度: 中）

`text-sm` が 187 箇所で本文として使われている。HIG の iOS 既定は 17pt。
02-design-system.md §2.2 では **16px（`text-base`）を既定**に改訂した。

**対応**: 一括置換はしない。**新規実装と、触ったファイルから寄せる。**
順序は「セッション中の画面 → 記録動線 → 一覧・サマリー → 設定系」。

### HIG-5. 下部タブバーがコンテンツと同じ平面に見える（優先度: 低）

現行は `bg-white border-t border-gray-100` の不透明バー。
HIG の現行デザイン言語（Liquid Glass）では、**コントロール層はコンテンツの上に浮き、
下のコンテンツが透けて見える**。

**対応**: 下部バーに限って半透明 + `backdrop-filter` を適用する（面積が小さいので負荷は許容範囲）。
`backdrop-filter` 非対応時に不透明へ落ちるよう、不透明の `background` を先に指定する。
→ 09-apple-hig.md §4

**やらないこと**: モーダルのオーバーレイやカードをぼかさない。
HIG は「**コンテンツ層に Liquid Glass を使うな**」と明示しており、
大面積の blur はモバイルで重い（04-motion.md §4）。

### HIG-6. コントロール間の余白（優先度: 低）

HIG は「サイズと同じくらい間隔が重要」とし、枠なし要素には**見えている端から約 24px**を求めている。
`MealCard.tsx` の削除ボタン（枠のない「×」）は、カロリー表示との間隔が `gap-3`(12px)。
枠なし要素としては不足しており、誤タップの代償が大きい操作でもある。

---

## 7. 進め方の提案

1 回の PR で全部やらない。以下の順で切ると差分が小さく、効果が大きい。

| # | 内容 | 影響範囲 | 得られるもの |
|---|---|---|---|
| 1 | `globals.css` に reduced-motion + `cursor: pointer` を追加 | 2 ルール | H2 / H3 が一括解決 |
| 2 | `ui/Modal.tsx` の a11y 強化 | 1 ファイル | 全モーダルが改善（M6） |
| 3 | `ui/Button.tsx` を作り、主要 CTA から置換 | 段階的 | H3 / H4 / ウェイト統一 |
| 4 | `ui/Field.tsx` を作り、モーダルのフォームから置換 | 段階的 | H1 |
| 5 | カラートークン一本化（ドメイン単位） | 段階的 | M3 / H4 の残り |
| 6 | `ConfirmDialog` / `Toast` を作り `window.confirm` を置換 | 段階的 | M5 |
| 7 | 未使用 GLB の削除 + `frameloop` 制御 + 3D の reduced-motion | 3 ファイル | 3D-1 / 3D-3 / 3D-4 |
| 8 | ジムセッション中の文字を大きく・濃く | 1 ファイル | HIG-1（**体感が一番変わる**） |
| 9 | `alert()` バリデーションをインラインエラーへ | 4 ファイル | HIG-3 / H1 |
| 10 | 下部タブバーを半透明 + `backdrop-blur` に | 1 ファイル | HIG-5 |

各 PR で 06-checklist.md を通すこと。
