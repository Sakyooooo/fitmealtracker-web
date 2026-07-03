# データ同期の仕様

FitMealTracker は **ローカルファースト**。すべての記録はまず端末内（localStorage / 写真は IndexedDB）に保存され、UI はローカルの値だけで完結する。Supabase 同期は「別端末・再インストール後にデータを取り戻す」ための**バックアップ／復元レイヤ**であり、無効でも全機能が動く。

## 保存とID

- 本人IDは Supabase 匿名認証の `auth.uid()`。匿名認証が無効／オフラインのときは localStorage の UUID にフォールバックする（[identity.ts](../src/lib/identity.ts) の `ensureAuthUserId`）。
- どの画面から使い始めても同期が壊れないよう、常駐の [AppDataProvider](../src/store/AppDataProvider.tsx) が起動時に `ensureAuthUserId → syncUserToSupabase` を実行し、`users` 行の存在を保証する（この行が無いと `meals`/`exercises` の外部キー制約に違反する）。

## 種類別の同期挙動

| 種類 | 保存 | 起動時の取り込み（マージ） | 主体 |
|---|---|---|---|
| 食事 meals | 保存時に push | ✅ 自動（ローカルに無いidを追加） | AppDataProvider |
| 運動 exercises | 保存時に push | ✅ 自動（同上） | AppDataProvider |
| 体重 weights | 保存時に push | ✅ 自動（id union＋日付降順） | AppDataProvider |
| マイ食品 my_foods | 保存時に push | ✅ 自動（updatedAt が新しい方） | [useMyFoods](../src/hooks/useMyFoods.ts) |
| レシピ recipes | 保存時に push | ✅ 自動（updatedAt が新しい方） | [useRecipes](../src/hooks/useRecipes.ts) |
| 食事写真 | 保存時に Storage へ upload → `photo_url` | ⛔ 取り込まない（端末ローカルの IndexedDB 管理） | AppDataProvider |
| ジムセッション | 保存時に push | ⛔ 起動時マージなし（進行中セッションはローカル前提） | AppDataProvider |
| 設定 settings | localStorage のみ | ⛔ 同期しない（端末ごと） | AppDataProvider |

### マージ方針
- **meals / exercises**: id ベースの追記のみ（削除は同期されない＝ある端末で消しても他端末には残る）。同じidは重複させない。
- **weights / my_foods / recipes**: それぞれ id union、`updatedAt` の新しい方を採用。
- 競合解決は「最後に書いた方が勝つ」ではなく上記の追記／新しい方優先。**同一レコードを複数端末で同時編集するケースは想定しない**（個人利用のMVP前提）。

## 明示的な復元

別端末や初期化後に「連携アカウントへサインイン → クラウドから復元」する導線が [AccountLinkCard](../src/components/profile/AccountLinkCard.tsx) にある。内部は [syncDownAllFromSupabase](../src/lib/supabaseRepository.ts)（meals/exercises/weights/my_foods を bulk import）。起動時の自動マージと重複しても id で冪等。

## 公開範囲（プライバシー）

- 食事・運動は現状 `is_public: true` 固定で、フレンドのタイムラインに表示される。
- 体重・マイ食品・レシピ・設定は**本人のみ**（owner-scoped RLS。フレンドから見えない）。

## 未整備・既知の制約

- **削除の非同期**: meals/exercises/weights は追記マージのため、片方の端末での削除が他端末に伝播しない。
- **レコード単位の公開トグルが無い**: 食事は全公開か（Supabase無効で）非共有かの二択。
- **写真は端末間で復元されない**: `photo_url` はタイムライン表示に使うが、自分のカレンダー等ではローカル写真前提。
