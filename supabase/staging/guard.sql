-- APPROVAL TARGET ONLY: faroway-staging / omovikloadpvzijoaqus / Testimonio.
-- The executing connector/operator MUST independently bind to that project.
-- SQL cannot prove the remote project identity from a caller-supplied setting.
-- Fresh-install guard blocks the populated production application schema.
DO $$ BEGIN
  IF current_setting('server_version_num')::INTEGER <> 170011 THEN
    RAISE EXCEPTION 'This approval bundle was validated only on PostgreSQL 17.11';
  END IF;
  IF to_regclass('public.users') IS NOT NULL OR to_regclass('public.trips') IS NOT NULL
     OR to_regclass('public.blog_posts') IS NOT NULL OR to_regclass('public.destinations') IS NOT NULL THEN
    RAISE EXCEPTION 'Fresh staging schema required; never apply this bundle to an existing application database';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
     OR to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Supabase platform schemas must already exist';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION 'Supabase Realtime publication must already exist';
  END IF;
END $$;
SET search_path=public,extensions;
SET lock_timeout='2s';
SET statement_timeout='60s';
