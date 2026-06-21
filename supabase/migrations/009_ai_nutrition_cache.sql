-- ============================================================
-- FitMealTracker: AI推定結果のキャッシュ（料理名 → 栄養）
-- Supabase ダッシュボード > SQL Editor で実行
-- ※ 004（匿名認証ベースのRLS）適用後に実行すること
--
-- 目的: AI(Gemini)が一度推定した料理の栄養を蓄積し、次回以降は
--   AIを呼ばず同じ値を返す（API費用の削減＋数値の一貫性、DBが育つ）。
-- 読取は全員可（共有キャッシュ）。書込はサインイン済み（匿名含む）ユーザー。
-- ============================================================

create table if not exists ai_nutrition_cache (
  name_key    text        primary key,      -- 正規化した料理名（小文字・記号/空白除去）
  name        text        not null,         -- 表示用の料理名
  kcal        int         not null,
  protein     float,
  fat         float,
  carbs       float,
  serving     text,                         -- 例: "1人前"
  source      text        not null default 'ai',
  hits        int         not null default 1, -- 参照回数（人気の指標）
  updated_at  timestamptz not null default now()
);

create index if not exists ai_nutrition_cache_hits_idx on ai_nutrition_cache (hits desc);

alter table ai_nutrition_cache enable row level security;

drop policy if exists ai_cache_select on ai_nutrition_cache;
drop policy if exists ai_cache_insert on ai_nutrition_cache;
drop policy if exists ai_cache_update on ai_nutrition_cache;

create policy ai_cache_select on ai_nutrition_cache for select using (true);
create policy ai_cache_insert on ai_nutrition_cache for insert with check (auth.uid() is not null);
create policy ai_cache_update on ai_nutrition_cache for update using (auth.uid() is not null);

comment on table ai_nutrition_cache is 'AI推定栄養の共有キャッシュ。料理名キーで再利用しGemini呼び出しを削減する';
