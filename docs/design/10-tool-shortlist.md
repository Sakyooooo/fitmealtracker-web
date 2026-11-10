# 10. 制作ツール早見表（他のアプリを作るときの参考）

出典: SNS で流れてきた「GitHub ツール 18 選」のリスト（モーション / 素材 / 物理 / 音 / 書き出し）。
**各ツールの README やライセンスは未確認。** 採用前に必ず公式リポジトリで最新状況を確認すること。

このリストは「作品（動画・3D・音）を作る」ための道具の一覧で、
「軽く速く動く PWA を保つ」FitMealTracker とは向きが逆。
FitMealTracker では SVGO 以外は不要と判断した。**アプリの種類が変われば結論も変わる**ので、
種類別に整理しておく。

---

## 1. FitMealTracker（Next.js PWA・記録系）での判定

| 判定 | ツール | 理由 |
|---|---|---|
| ✅ 使える | SVGO | 開発時のみ動く。`public/*.svg` の軽量化。アプリのサイズが増えない |
| ✅ 導入済み | Three.js | アバターで使用中 |
| △ 手元用 | FFmpeg / gifski | README 用のデモ動画・GIF を作る手元ツール。アプリには入れない |
| ❌ 不要 | Anime.js / Tween.js | CSS トランジションで足りる（04-motion.md） |
| ❌ 不要 | pmndrs/math | `three` に `MathUtils` がある |
| ❌ 不要 | Ammo.js | 物理演算が不要。WASM も重い |
| ❌ 不要 | TSL Textures / glslify | matcap + vertexColors 方針に反する（08-3d.md） |
| ❌ 不要 | Remotion / WebGLStudio / pbrt-v4 / OpenImageIO | 用途が合わない |
| ❌ 不要 | SuperCollider / FluidSynth / SoundTouchJS | 音の機能がない |
| △ 重複 | Assimp | Blender + Python スクリプトが既にある |

---

## 2. アプリの種類別：このリストが効くか

| 作るもの | 候補ツール | メモ |
|---|---|---|
| **動画を生成・書き出すアプリ**（紹介動画、SNS 用クリップ） | Remotion, FFmpeg, gifski | Remotion は React で動画を組む。書き出しは重いのでサーバー / CI 側で実行 |
| **インタラクティブ 3D / ゲーム** | Three.js, Ammo.js, TSL Textures, glslify, WebGLStudio | 物理が要るときだけ Ammo.js。**モバイルでは予算を決めてから入れる**（→ 08-3d.md） |
| **モーション重視の LP / ポートフォリオ** | Anime.js, Tween.js, Three.js | 通常アプリと違い演出が価値になる。それでも reduced-motion 対応は必須（→ 04-motion.md） |
| **音楽・音声アプリ** | SuperCollider, FluidSynth, SoundTouchJS | SoundTouchJS はブラウザでピッチ変更。iOS Safari は自動再生制限に注意 |
| **画像 / 3D 素材のパイプライン** | SVGO, Assimp, OpenImageIO, pbrt-v4 | 全部オフライン前処理。ランタイムには入れない |
| **記録系・業務系・SaaS**（FitMealTracker と同種） | SVGO のみ | 他は過剰。まず依存を増やさない |

---

## 3. 採用判断の基準（どのアプリでも使える）

1. **ランタイムに入るか、開発時だけか。** 開発時のみ（SVGO / FFmpeg / Assimp 等）は気軽に使える。
   ランタイムは初回ダウンロード量と起動時間に直結する
2. **標準機能で足りないか。** CSS トランジション、Web Animations API、`three` 同梱ユーティリティで済むなら入れない
3. **モバイルで動くか。** WASM や重い WebGL は、実機（特に iOS Safari）で確認してから決める
4. **止められるか。** ループするもの（物理・音・アニメ）は、画面外・非アクティブ・reduced-motion で止まること
5. **メンテされているか。** 最終コミット、ライセンス、Issue の状況を採用前に確認する

---

## 4. このリストに無いが、実務で効くもの

| ツール | 用途 | 備考 |
|---|---|---|
| **gltf-transform** | GLB の Draco / meshopt 圧縮、不要データ除去 | FitMealTracker の `exercise_avatar.glb`（3.5MB）に最適（→ 07 の 3D-2） |
| **Lighthouse / axe** | パフォーマンス・アクセシビリティ計測 | → 05-accessibility.md の確認手順 |
| **Playwright** | 実機相当の画面確認・スクリーンショット | このリポジトリは導入済み |
