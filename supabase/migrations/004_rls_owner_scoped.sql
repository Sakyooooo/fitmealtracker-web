-- ============================================================
-- FitMealTracker: RLS 引き締め（匿名認証ベース / 所有者スコープ）
-- F1（DB全開放）・F2（Storage全開放）の根本対策
--
-- ⚠️⚠️ 適用順序を必ず守ること ⚠️⚠️
--   1) Dashboard > Authentication > Sign In / Providers で
--      「Allow anonymous sign-ins（匿名サインイン）」を ON
--   2) 更新後のアプリを一度開き、各端末に匿名セッションを発行
--      （= auth.uid() が確定する。ここまでは旧RLSのまま）
--   3) ここで初めて本SQLを実行する
--
--   ❗ 先に本SQLを実行すると auth.uid() が無く、全ての書き込み・
--      フレンド読取が失敗してアプリが停止します。
--
-- 設計: identity = auth.uid()。
--   users.id / meals.user_id / exercises.user_id /
--   friendships.requester_id・receiver_id / reactions.from_user_id
--   はすべて auth.uid() と一致する前提。
--   （アプリ側は src/lib/identity.ts の ensureAuthUserId() で実現）
-- ============================================================

-- ── users ────────────────────────────────────────────────────────────────────
-- 読取は当面全員可（friend_code 検索のため）。
--   ※ 残課題: これは全ユーザー列挙が可能。後日 friend_code 完全一致の
--      SECURITY DEFINER RPC に置換して列挙を封じることを推奨。
-- 書込は本人(auth.uid)のみ。更新・削除ポリシーは付与しない（従来通り不可）。
DROP POLICY IF EXISTS users_insert_own ON users;
CREATE POLICY users_insert_own ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- ── meals ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS meals_select ON meals;
DROP POLICY IF EXISTS meals_insert ON meals;
DROP POLICY IF EXISTS meals_update ON meals;
DROP POLICY IF EXISTS meals_delete ON meals;

CREATE POLICY meals_insert ON meals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY meals_update ON meals
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY meals_delete ON meals
  FOR DELETE USING (user_id = auth.uid());

-- 読取: 本人 ＋ 承認済みフレンドの公開行のみ
CREATE POLICY meals_select ON meals
  FOR SELECT USING (
    user_id = auth.uid()
    OR (is_public AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.receiver_id = meals.user_id)
          OR (f.receiver_id = auth.uid() AND f.requester_id = meals.user_id))
    ))
  );

-- ── exercises ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS exercises_select ON exercises;
DROP POLICY IF EXISTS exercises_insert ON exercises;
DROP POLICY IF EXISTS exercises_update ON exercises;
DROP POLICY IF EXISTS exercises_delete ON exercises;

CREATE POLICY exercises_insert ON exercises
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY exercises_update ON exercises
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY exercises_delete ON exercises
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY exercises_select ON exercises
  FOR SELECT USING (
    user_id = auth.uid()
    OR (is_public AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = auth.uid() AND f.receiver_id = exercises.user_id)
          OR (f.receiver_id = auth.uid() AND f.requester_id = exercises.user_id))
    ))
  );

-- ── reactions ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS reactions_select ON reactions;
DROP POLICY IF EXISTS reactions_insert ON reactions;
DROP POLICY IF EXISTS reactions_delete ON reactions;

CREATE POLICY reactions_insert ON reactions
  FOR INSERT WITH CHECK (from_user_id = auth.uid());
CREATE POLICY reactions_delete ON reactions
  FOR DELETE USING (from_user_id = auth.uid());
-- 表示用に読取は許可（リアクション数の表示。必要に応じて絞り込み可）
CREATE POLICY reactions_select ON reactions
  FOR SELECT USING (true);

-- ── friendships ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS friendships_select ON friendships;
DROP POLICY IF EXISTS friendships_insert ON friendships;
DROP POLICY IF EXISTS friendships_update ON friendships;
DROP POLICY IF EXISTS friendships_delete ON friendships;

CREATE POLICY friendships_select ON friendships
  FOR SELECT USING (requester_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY friendships_insert ON friendships
  FOR INSERT WITH CHECK (requester_id = auth.uid());
CREATE POLICY friendships_update ON friendships
  FOR UPDATE USING (receiver_id = auth.uid() OR requester_id = auth.uid());
CREATE POLICY friendships_delete ON friendships
  FOR DELETE USING (requester_id = auth.uid() OR receiver_id = auth.uid());

-- ── storage: meal-photos（書込は所有者のみ。読取は公開のまま） ───────────────
DROP POLICY IF EXISTS meal_photos_insert ON storage.objects;
DROP POLICY IF EXISTS meal_photos_update ON storage.objects;
DROP POLICY IF EXISTS meal_photos_delete ON storage.objects;

CREATE POLICY meal_photos_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'meal-photos' AND owner = auth.uid());
CREATE POLICY meal_photos_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'meal-photos' AND owner = auth.uid());
CREATE POLICY meal_photos_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'meal-photos' AND owner = auth.uid());
-- meal_photos_read（SELECT, USING bucket_id='meal-photos'）は 003 のまま維持
