"""Regression-check helper hardening against the frozen schema, networkless PG only."""
from pathlib import Path
import hashlib
import json
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
IMAGE = 'postgres:17.11-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
name = 'faroway-helper-' + uuid.uuid4().hex[:10]
functions = "'cleanup_expired_anonymous_trips','cleanup_old_workflow_data','normalize_destination','update_updated_at_column','update_push_token_timestamp'"


def sql(source, ok=True):
    result = subprocess.run(['docker', 'exec', '-i', name, 'psql', '-h', '127.0.0.1', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], input=source, text=True, capture_output=True)
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    if not ok:
        assert result.returncode, 'Expected rejection'
    return result.stdout.strip()


try:
    subprocess.run(['docker', 'run', '--detach', '--rm', '--network', 'none', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE], check=True, stdout=subprocess.DEVNULL)
    for _ in range(80):
        if subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            break
        time.sleep(.25)
    else:
        raise AssertionError('Local PostgreSQL unavailable')
    sql((ROOT / 'scripts/staging/platform-fixture.sql').read_text())
    sql((ROOT / 'supabase/staging/approval/bootstrap.sql').read_text())
    metadata = f"SELECT jsonb_agg(jsonb_build_object('name',proname,'acl',proacl,'definer',prosecdef,'volatility',provolatile) ORDER BY proname) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ({functions});"
    before = sql(metadata)
    entry = next(x for x in json.loads((ROOT / 'supabase/release-candidate/migrations.json').read_text())['application_order'] if x['source'].endswith('helper-search-paths.sql'))
    source = (ROOT / entry['path']).read_text()
    assert hashlib.sha256(source.encode()).hexdigest() == entry['sha256']
    sql(source)
    assert sql(metadata) == before, 'Function privileges or execution semantics changed'
    assert sql(f"SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ({functions}) AND proconfig=ARRAY['search_path=pg_catalog'];") == '5'
    print('PASS fixed search paths preserve existing grants, invoker behavior and volatility', flush=True)
    # Shadow relations must not intercept a maintenance call from an unusual session path.
    sql("CREATE TEMP TABLE trips(marker text); INSERT INTO trips VALUES('keep'); CREATE TEMP TABLE searches(marker text); INSERT INTO searches VALUES('keep'); CREATE TEMP TABLE workflow_runs(marker text); INSERT INTO workflow_runs VALUES('keep'); CREATE TEMP TABLE realtime_events(marker text); INSERT INTO realtime_events VALUES('keep'); CREATE TEMP TABLE notifications(marker text); INSERT INTO notifications VALUES('keep'); SET search_path=pg_temp; SELECT public.cleanup_expired_anonymous_trips(); SELECT public.cleanup_old_workflow_data();")
    # A separate session tests real trigger paths and expiry cleanup against the real schema.
    owner = '00000000-0000-4000-8000-000000000011'
    sql(f"INSERT INTO auth.users(id,email) VALUES('{owner}','fixture@example.invalid'); INSERT INTO public.push_tokens(user_id,token,platform) VALUES('{owner}','ExpoPushToken[fixture]','ios'); SET search_path=pg_catalog; UPDATE public.push_tokens SET is_active=false; UPDATE public.users SET display_name='Test' WHERE id='{owner}';")
    assert sql("SET ROLE service_role; SET search_path=pg_catalog; SELECT public.normalize_destination('  Paris, France ');") == 'paris'
    for role in ['anon', 'authenticated']:
        sql(f"SET ROLE {role}; SELECT public.normalize_destination('Paris');", False)
        sql(f"SET ROLE {role}; SELECT public.cleanup_old_workflow_data();", False)
    sql("INSERT INTO public.trips(destination,start_date,end_date,expires_at) VALUES('Expired fixture','2099-01-01','2099-01-02',now()-interval '1 day');")
    assert sql('SET ROLE service_role; SELECT public.cleanup_expired_anonymous_trips();') == '1'
    assert sql("SELECT count(*) FROM public.trips WHERE destination='Expired fixture';") == '0'
    sql(source)
    assert sql(metadata) == before
    print('PASS qualified maintenance, trigger execution, normalization, client denial and repeat application', flush=True)
    # Later hardening must stay in the reviewed inventory without changing the
    # frozen bootstrap. Replacing functions must preserve its client denials.
    latest = next(x for x in json.loads((ROOT / 'supabase/release-candidate/migrations.json').read_text())['application_order'] if x['path'].endswith('pin_empty_function_search_paths.sql'))
    source = (ROOT / latest['path']).read_bytes()
    assert hashlib.sha256(source).hexdigest() == latest['sha256']
    sql(source.decode())
    assert sql(metadata) == before
    assert sql(f"SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ({functions}) AND proconfig=ARRAY['search_path=\"\"'];") == '5'
    for role in ['anon', 'authenticated']:
        sql(f"SET ROLE {role}; SELECT * FROM public.get_user_push_tokens('{owner}');", False)
        sql(f"SET ROLE {role}; SELECT public.deactivate_push_token('ExpoPushToken[fixture]');", False)
    sql("INSERT INTO auth.users(id,email) VALUES('00000000-0000-4000-8000-000000000012','second-fixture@example.invalid');")
    assert sql("SELECT count(*) FROM public.users WHERE id='00000000-0000-4000-8000-000000000012';") == '1'
    print('PASS later empty-path hardening preserves frozen bootstrap privileges and signup triggers', flush=True)
    editorial = next(x for x in json.loads((ROOT / 'supabase/release-candidate/migrations.json').read_text())['application_order'] if x['path'].endswith('restrict_editorial_metric_helpers.sql'))
    source = (ROOT / editorial['path']).read_bytes()
    assert hashlib.sha256(source).hexdigest() == editorial['sha256']
    signatures = ['public.get_destination_trip_counts(timestamptz)', 'public.get_destination_search_counts(timestamptz)', 'public.increment_blog_view_count(text)']
    for signature in signatures:
        sql(f'GRANT EXECUTE ON FUNCTION {signature} TO PUBLIC, anon, authenticated;')
    sql(source.decode())
    for signature in signatures:
        for role in ['anon', 'authenticated']:
            assert sql(f"SELECT has_function_privilege('{role}','{signature}','execute');") == 'f'
        assert sql(f"SELECT has_function_privilege('service_role','{signature}','execute');") == 't'
    sql("SET ROLE service_role; SELECT * FROM public.get_destination_trip_counts(NULL); SELECT * FROM public.get_destination_search_counts(NULL); SELECT public.increment_blog_view_count('missing-fixture');")
    print('PASS editorial metrics reject direct client RPC access and preserve server routes', flush=True)

finally:
    subprocess.run(['docker', 'rm', '--force', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
