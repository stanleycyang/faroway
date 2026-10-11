-- LOCAL TEST ONLY. Never included in the external staging approval bundle.
-- Models only platform objects referenced by the real application migrations.
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
CREATE TABLE auth.users(id UUID PRIMARY KEY,email TEXT,raw_app_meta_data JSONB DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE SQL STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),current_user::TEXT) $$;
CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE SQL STABLE AS $$ SELECT jsonb_build_object('sub',auth.uid(),'role',auth.role()) $$;
GRANT USAGE ON SCHEMA auth,storage,extensions TO anon,authenticated,service_role;
CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN,file_size_limit BIGINT,allowed_mime_types TEXT[]);
CREATE TABLE storage.objects(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id TEXT REFERENCES storage.buckets(id),name TEXT,owner UUID);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON storage.objects TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects,storage.buckets TO service_role;
-- No public application default table grants: automatic table exposure is off.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER DATABASE postgres SET search_path=public,extensions;
CREATE PUBLICATION supabase_realtime;
