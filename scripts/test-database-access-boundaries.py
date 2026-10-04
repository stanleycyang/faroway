"""Run draft migrations against disposable real Postgres. No ports/volumes/secrets."""
from pathlib import Path
import concurrent.futures
import subprocess
import time
import uuid
import json

root = Path(__file__).resolve().parents[1]
name = "faroway-permissions-" + uuid.uuid4().hex[:10]

def sql(source, ok=True):
    result = subprocess.run(["docker", "exec", "-i", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"], input=source, text=True, capture_output=True)
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    if not ok:
        assert result.returncode, "Expected permission rejection"
    return result.stdout.strip()

owner = "00000000-0000-4000-8000-000000000001"
other = "00000000-0000-4000-8000-000000000002"
try:
    subprocess.run(["docker", "run", "--detach", "--rm", "--network", "none", "--name", name, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16-alpine"], check=True, stdout=subprocess.DEVNULL)
    for _ in range(60):
        if subprocess.run(["docker", "exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0: break
        time.sleep(.25)
    else: raise AssertionError("Local Postgres did not become ready")
    sql("""
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::UUID $$;
    CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE SQL STABLE AS $$ SELECT jsonb_build_object('role',current_user) $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE SQL STABLE AS $$ SELECT current_user::TEXT $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    CREATE TABLE searches (id UUID PRIMARY KEY);
    CREATE TABLE trips (id UUID PRIMARY KEY);
    """)
    for migration in ["20260220100000_push_tokens.sql", "20260206_affiliate_tracking.sql"]:
        sql((root / "supabase/migrations" / migration).read_text())
    # Include already-deployed affiliate policies; do not test against obsolete RLS.
    lockdown=(root / "supabase/migrations/20260725002000_lock_down_tracking_and_search_rls.sql").read_text()
    sql(lockdown[lockdown.index('DROP POLICY IF EXISTS "Anyone can insert clicks"'):lockdown.index('REVOKE ALL ON FUNCTION')])
    sql("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;")
    sql(f"INSERT INTO auth.users VALUES ('{owner}'),('{other}'); INSERT INTO push_tokens(user_id,token,platform) VALUES ('{owner}','synthetic-owner','ios'),('{other}','synthetic-other','android');")
    sql(f"INSERT INTO affiliate_clicks(id,user_id,item_type,item_id,item_name,affiliate_partner,affiliate_url) VALUES ('a','{owner}','activity','a','A','test','https://example.invalid'),('b','{other}','activity','b','B','test','https://example.invalid');")
    assert sql(f"SET ROLE anon; SELECT count(*) FROM get_user_push_tokens('{other}');") == '1'
    assert sql("SET ROLE anon; SELECT sum(clicks) FROM affiliate_stats;") == '2'
    print("PASS reproduces legacy privileged-helper and owner-view exposure with deployed affiliate RLS")
    fix=(root / "supabase/migrations/20261004001000_restrict_privileged_database_helpers.sql").read_text()
    sql(fix); sql(fix)
    for role in ['anon','authenticated']:
        prefix=f"SET ROLE {role}; SET request.jwt.claim.sub='{owner}'; "
        sql(prefix+f"SELECT * FROM get_user_push_tokens('{other}');",ok=False)
        sql(prefix+"SELECT deactivate_push_token('synthetic-other');",ok=False)
        sql(prefix+"SELECT * FROM affiliate_stats;",ok=False)
    assert sql("SELECT is_active FROM push_tokens WHERE token='synthetic-other';") == 't'
    print("PASS anon/authenticated cannot invoke privileged token helpers or read global affiliate metrics")
    prefix=f"SET ROLE authenticated; SET request.jwt.claim.sub='{owner}'; "
    assert sql(prefix+"SELECT count(*) FROM push_tokens;") == '1'
    sql(prefix+f"INSERT INTO push_tokens(user_id,token,platform) VALUES ('{owner}','synthetic-owner','ios') ON CONFLICT(user_id,token) DO UPDATE SET is_active=true;")
    assert sql(prefix+"UPDATE push_tokens SET is_active=false WHERE token='synthetic-other' RETURNING token;") == ''
    assert sql(prefix+"DELETE FROM push_tokens WHERE token='synthetic-other' RETURNING token;") == ''
    sql(prefix+f"INSERT INTO push_tokens(user_id,token,platform) VALUES ('{other}','forbidden','ios');",ok=False)
    assert sql(prefix+"DELETE FROM push_tokens WHERE token='synthetic-owner' RETURNING token;") == 'synthetic-owner'
    assert sql("SET ROLE service_role; SELECT count(*) FROM get_user_push_tokens('"+other+"');") == '1'
    sql("SET ROLE service_role; SELECT deactivate_push_token('synthetic-other');")
    assert sql("SELECT is_active FROM push_tokens WHERE token='synthetic-other';") == 'f'
    assert sql("SET ROLE service_role; SELECT sum(clicks) FROM affiliate_stats;") == '2'
    assert sql("SELECT count(*) FROM pg_proc WHERE proname IN ('get_user_push_tokens','deactivate_push_token') AND proconfig @> ARRAY['search_path=public, pg_temp'];") == '2'
    print("PASS existing owner token management and server operations remain usable; fixed helper search paths")
finally:
    subprocess.run(["docker", "rm", "--force", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
