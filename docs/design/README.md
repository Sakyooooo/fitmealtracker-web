# FitMealTracker デザインガイド

参考にした 6 つの UI/UX リソースを FitMealTracker の実装ルールに落とし込んだドキュメント群です。
「毎回デザインを考え直さない」「実装の揺れを減らす」ことが目的で、
新しい画面・コンポーネントを追加するときの参照元になります。

## ファイル構成

| ファイル | 中身 | いつ読むか |
|---|---|---|
| [01-references.md](./01-references.md) | 参考 6 サイトの要約と使い分け | 引き出しが欲しいとき / インスピレーション探し |
| [02-design-system.md](./02-design-system.md) | 色・タイポ・余白・角丸・影・レイアウトのトークン | 新しい画面を作る前に必ず |
| [03-components.md](./03-components.md) | コンポーネントの契約（Button/Card/Modal/Form/Chart…） | UI を実装する直前 |
| [04-motion.md](./04-motion.md) | アニメーション・インタラクション規約（60fps 原則） | 動きをつけるとき |
| [05-accessibility.md](./05-accessibility.md) | コントラスト・タップ領域・キーボード・reduced-motion | 実装中〜レビュー前 |
| [06-checklist.md](./06-checklist.md) | 設計前 / 実装中 / PR 前のチェックリスト | コミット前に毎回 |
| [07-audit-backlog.md](./07-audit-backlog.md) | 現コードベースの監査結果と改善バックログ | 改善タスクを選ぶとき |
| [08-3d.md](./08-3d.md) | Three.js / WebGL の運用規約（予算・停止条件・a11y） | 3D を触るとき（運動タブのアバター、演出） |

スクリーンショットは [`screens/`](./screens/) に置いてあります（既存画面の見た目リファレンス）。

## 開発フロー（AGENTS.md の 要件 → 設計 → 実装 → テスト に接続）

```
1. 要件整理
2. 設計       ← 02-design-system.md / 03-components.md でトークンとパターンを選ぶ
                 06-checklist.md「設計前チェック」を通す
3. 実装       ← 04-motion.md / 05-accessibility.md を横に置く
4. テスト     ← 06-checklist.md「PR 前チェック」を通す
```

## 3 行サマリ（迷ったらこれだけ）

1. **色・サイズ・角丸・余白は 02 のトークンから選ぶ。**新しい値を発明しない。
2. **動きは transform / opacity のみ。**150〜300ms、`prefers-reduced-motion` を必ず尊重する。
3. **押せるものは 44×44px 以上・focus-visible リングあり・aria-label あり。**

## 参考サイト

- [Inspora](https://www.inspora.design/) — 最新ビジュアルデザインのキュレーションアーカイブ
- [60fps](https://60fps.design/) — 実アプリの UI アニメーション事例ライブラリ
- [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — 業種別デザインシステム生成 + 納品前チェックリスト
- [coss ui](https://coss.com/ui) — Cal.com のデザインシステム（Base UI + Tailwind、コピペ所有型）
- [HeroUI](https://heroui.com/) — React Aria + Tailwind のアクセシブルなコンポーネントライブラリ
- [ThreeUI](https://threeui.com/browse) — Three.js / WebGL コンポーネントのカタログ（ライブプレビュー + ソース）
