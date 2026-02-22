-- Allow anonymous trip creation by making user_id nullable.
-- The FK constraint still references users(id) but Postgres allows NULL in FK columns.
-- RLS policies (auth.uid() = user_id) only apply to authenticated queries;
-- anonymous trips are accessed via service role client which bypasses RLS.

ALTER TABLE trips ALTER COLUMN user_id DROP NOT NULL;
