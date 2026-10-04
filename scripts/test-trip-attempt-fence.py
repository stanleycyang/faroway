"""Run draft migrations against disposable real Postgres. No ports/volumes/secrets."""
from pathlib import Path
import concurrent.futures
import subprocess
import time
import uuid
import json

root = Path(__file__).resolve().parents[1]
name = "faroway-fence-" + uuid.uuid4().hex[:10]

def sql(source, ok=True):
    result = subprocess.run(["docker", "exec", "-i", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"], input=source, text=True, capture_output=True)
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    if not ok:
        assert result.returncode, "Expected permission rejection"
    return result.stdout.strip()

owner = "00000000-0000-4000-8000-000000000001"
other = "00000000-0000-4000-8000-000000000002"
trip = "10000000-0000-4000-8000-000000000001"
a = "20000000-0000-4000-8000-000000000001"
b = "20000000-0000-4000-8000-000000000002"
foreign = "20000000-0000-4000-8000-000000000003"

def apply(search, state, payload='{}'):
    return sql(f"SELECT apply_trip_generation_update('{trip}', '{search}', '{state}', '{payload}'::jsonb);")

try:
    subprocess.run(["docker", "run", "--detach", "--rm", "--network", "none", "--name", name, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:16-alpine"], check=True, stdout=subprocess.DEVNULL)
    for _ in range(60):
        if subprocess.run(["docker", "exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0: break
        time.sleep(.25)
    else: raise AssertionError("Local Postgres did not become ready")
    sql("""
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE searches (id UUID PRIMARY KEY, user_id UUID, status TEXT DEFAULT 'pending', workflow_run_id TEXT);
    CREATE TABLE trips (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, destination TEXT, travelers INTEGER DEFAULT 2, budget_tier TEXT DEFAULT 'moderate', vibes TEXT[], preferences JSONB, start_date DATE, end_date DATE, status TEXT DEFAULT 'draft', search_id UUID REFERENCES searches(id) ON DELETE SET NULL, itinerary_id UUID, is_shared BOOLEAN DEFAULT FALSE, share_token TEXT, shared_at TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE itineraries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID REFERENCES trips(id), user_id UUID, destination TEXT, start_date DATE, end_date DATE, overview TEXT, total_cost JSONB, days JSONB, packing_list TEXT[], general_tips TEXT[], generated_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE workflow_progress (trip_id UUID PRIMARY KEY REFERENCES trips(id), user_id UUID, step TEXT, progress INTEGER CHECK(progress BETWEEN 0 AND 100), message TEXT, updated_at TIMESTAMPTZ);
    CREATE TABLE affiliate_clicks (id TEXT PRIMARY KEY,user_id UUID,trip_id UUID,item_id TEXT,item_type TEXT,item_name TEXT,affiliate_partner TEXT,affiliate_url TEXT,source TEXT,converted BOOLEAN,clicked_at TIMESTAMPTZ);
    CREATE TABLE notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, type TEXT, title TEXT, message TEXT, data JSONB, read BOOLEAN);
    ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
    CREATE POLICY search_owner_access ON searches TO authenticated USING (user_id::TEXT = current_setting('request.jwt.claim.sub', TRUE)) WITH CHECK (user_id::TEXT = current_setting('request.jwt.claim.sub', TRUE));
    GRANT SELECT, INSERT, UPDATE, DELETE ON searches TO authenticated;
    ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_access ON trips TO authenticated USING (user_id::TEXT = current_setting('request.jwt.claim.sub', TRUE)) WITH CHECK (user_id::TEXT = current_setting('request.jwt.claim.sub', TRUE));
    GRANT SELECT, INSERT, UPDATE, DELETE ON trips TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    """)
    for migration in ["20261003001000_fence_trip_generation.sql", "20261003002000_protect_trip_lifecycle.sql", "20261003003000_protect_search_run_binding.sql", "20261003004000_require_terminal_generation_evidence.sql"]:
        script = (root / "supabase/migrations" / migration).read_text()
        sql(script); sql(script)  # Reapplication is safe.
    sql(f"INSERT INTO searches(id,user_id) VALUES ('{a}','{owner}'), ('{b}','{owner}'), ('{foreign}','{other}'); INSERT INTO trips(id,user_id,destination,start_date,end_date) VALUES ('{trip}','{owner}','Paris','2099-06-01','2099-06-03');")
    auth = f"SET ROLE authenticated; SET request.jwt.claim.sub = '{owner}'; "
    sql(auth + f"UPDATE trips SET destination='Rome' WHERE id='{trip}';")
    for mutation in [f"search_id='{foreign}'", "status='generating'", "is_shared=TRUE,share_token='bypass'"]:
        sql(auth + f"UPDATE trips SET {mutation} WHERE id='{trip}';", ok=False)
    sql(auth + f"INSERT INTO trips(user_id,status,search_id) VALUES ('{owner}','generating','{foreign}');", ok=False)
    sql(auth + f"SELECT apply_trip_generation_update('{trip}','{a}','planned','{{}}');", ok=False)
    assert sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{other}'; SELECT count(*) FROM trips WHERE id='{trip}';") == '0'
    print("PASS direct REST-equivalent lifecycle protection, ordinary edit, cross-user RLS and RPC permissions")
    # Enable uses the timestamp observed before consent. A later revoke wins.
    version = sql(f"SELECT updated_at FROM trips WHERE id='{trip}';")
    sql(f"UPDATE trips SET is_shared=FALSE,share_token=NULL,updated_at=clock_timestamp() WHERE id='{trip}';")
    assert sql(f"UPDATE trips SET is_shared=TRUE,share_token='stale-enable',updated_at=clock_timestamp() WHERE id='{trip}' AND user_id='{owner}' AND is_shared=FALSE AND updated_at='{version}' RETURNING id;") == ''
    assert sql(f"SELECT is_shared FROM trips WHERE id='{trip}';") == 'f'
    version = sql(f"SELECT updated_at FROM trips WHERE id='{trip}';")
    assert sql(f"UPDATE trips SET is_shared=TRUE,share_token='current-enable',updated_at=clock_timestamp() WHERE id='{trip}' AND user_id='{owner}' AND is_shared=FALSE AND updated_at='{version}' RETURNING id;") == trip
    sql(f"UPDATE trips SET is_shared=FALSE,share_token=NULL,shared_at=NULL,updated_at=clock_timestamp() WHERE id='{trip}' AND user_id='{owner}';")
    assert sql(f"SELECT count(*) FROM trips WHERE share_token='current-enable' OR is_shared;") == '0'
    print("PASS timestamp compare-and-swap rejects stale enable after revoke; revoke after enable invalidates token")
    for mutation in ["workflow_run_id='older-failed-run'", "status='error'", "workflow_run_verified=TRUE", f"id='{uuid.uuid4()}'", f"user_id='{other}'"]:
        sql(auth + f"UPDATE searches SET {mutation} WHERE id='{a}';", ok=False)
    sql(auth + f"DELETE FROM searches WHERE id='{a}';", ok=False)
    sql(auth + f"INSERT INTO searches(id,user_id,workflow_run_id) VALUES ('{uuid.uuid4()}','{owner}','forged-run');", ok=False)
    assert sql(auth + f"SELECT count(*) FROM searches WHERE id='{a}';") == '1'
    assert sql(f"SELECT workflow_run_verified FROM searches WHERE id='{a}';") == 'f'
    sql(f"SET ROLE service_role; UPDATE searches SET workflow_run_id='server-run',workflow_run_verified=TRUE WHERE id='{a}';")
    assert sql(f"SELECT workflow_run_id FROM searches WHERE id='{a}';") == 'server-run'
    print("PASS authenticated search run/status/ownership/ID/verification mutations, insert and delete rejected; service write allowed")
    def claim(search):
        return sql(f"UPDATE trips SET status='generating',search_id='{search}' WHERE id='{trip}' AND user_id='{owner}' AND status='draft' RETURNING id;")
    with concurrent.futures.ThreadPoolExecutor() as pool:
        claims = list(pool.map(claim, [a, b]))
    assert sum(bool(value) for value in claims) == 1
    current = sql(f"SELECT search_id FROM trips WHERE id='{trip}';")
    stale = b if current == a else a
    assert apply(stale, "planned", '{"days":[],"overview":"stale"}') == 'f'
    assert apply(stale, "failed", '{"message":"stale"}') == 'f'
    assert apply(stale, "progress", '{"step":"stale","progress":90}') == 'f'
    assert sql("SELECT count(*) FROM itineraries;") == '0'
    assert sql("SELECT count(*) FROM notifications;") == '0'
    print("PASS concurrent claims and stale completion/failure/progress rejection")
    assert apply(current, "planned", '{"days":[],"overview":"current","total_cost":100}') == 't'
    assert apply(current, "planned", '{"days":[],"overview":"duplicate"}') == 't'
    assert sql("SELECT overview FROM itineraries;") == 'current'
    assert sql("SELECT count(*) FROM notifications;") == '1'
    assert sql(f"SELECT status FROM trips WHERE id='{trip}';") == 'planned'
    print("PASS atomic completion and idempotent notification")
    # A newer claim holds the trip row lock while a stale terminal write arrives.
    sql(f"UPDATE trips SET status='failed' WHERE id='{trip}';")
    holder = subprocess.Popen(["docker", "exec", "-i", name, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    holder.stdin.write(f"BEGIN; UPDATE trips SET status='generating',search_id='{stale}' WHERE id='{trip}'; SELECT 'locked'; SELECT pg_sleep(0.5); COMMIT;\n"); holder.stdin.close()
    assert holder.stdout.readline().strip() == 'locked'
    assert apply(current, "planned", '{"days":[],"overview":"late completion"}') == 'f'
    assert holder.wait(timeout=10) == 0
    assert sql("SELECT overview FROM itineraries;") == 'current'
    assert sql(f"SELECT search_id FROM trips WHERE id='{trip}';") == stale
    sql(f"UPDATE trips SET updated_at=NOW()-INTERVAL '2 hours' WHERE id='{trip}';")
    assert '"trips": 0' in sql("SELECT cleanup_stale_generation_state();")
    assert sql(f"SELECT status FROM trips WHERE id='{trip}';") == 'generating'
    sql(auth + "SELECT cleanup_stale_generation_state();", ok=False)
    print("PASS timeout cleanup cannot release an unidentified active planning claim")
    print("PASS overlapping new claim and old completion serialize on the row lock")
    brief_migration = root / "supabase/migrations/20261003005000_version_trip_briefs.sql"
    if brief_migration.exists():
        # Reproduce the existing production timestamp trigger, including its name/order.
        sql("""
        CREATE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
        BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        """)
        sql(brief_migration.read_text()); sql(brief_migration.read_text())
        sql(f"SET ROLE service_role; UPDATE trips SET destination='Unsafe edit' WHERE id='{trip}';", ok=False)
        sql(f"UPDATE trips SET status='planned',is_shared=TRUE,share_token='old-public-link' WHERE id='{trip}';")
        sql(f"SET ROLE service_role; UPDATE trips SET destination='Unsafe planned edit' WHERE id='{trip}';", ok=False)
        version = sql(f"SELECT updated_at FROM trips WHERE id='{trip}';")
        sql(auth + f"UPDATE trips SET destination='Direct edit' WHERE id='{trip}';", ok=False)
        sql(auth + f"SELECT * FROM update_trip_brief('{trip}','{owner}','{version}','{{}}');", ok=False)
        assert sql(f"SET ROLE service_role; SELECT id FROM update_trip_brief('{trip}','{owner}','{version}','{{\"destination\":\"Vienna\",\"preferences\":{{\"interests\":[\"art\"]}}}}');") == trip
        sql(f"SET ROLE service_role; UPDATE trips SET destination='Unsafe draft edit' WHERE id='{trip}';", ok=False)
        assert sql(f"SELECT status || ':' || is_shared::TEXT || ':' || (preferences->>'planNeedsRefresh') FROM trips WHERE id='{trip}';") == 'draft:false:true'
        assert sql("SELECT overview FROM itineraries;") == 'current'
        assert sql(f"SELECT count(*) FROM trips WHERE share_token='old-public-link' OR search_id IS NOT NULL;") == '0'
        assert sql(f"SELECT id FROM update_trip_brief('{trip}','{owner}','{version}','{{\"destination\":\"Stale edit\"}}');") == ''
        assert sql(f"UPDATE trips SET status='generating',search_id='{a}' WHERE id='{trip}' AND status='draft' AND updated_at='{version}' RETURNING id;") == ''
        version = sql(f"SELECT updated_at FROM trips WHERE id='{trip}';")
        assert sql(f"UPDATE trips SET status='generating',search_id='{a}' WHERE id='{trip}' AND updated_at='{version}' RETURNING id;") == trip
        assert sql(f"SELECT id FROM update_trip_brief('{trip}','{owner}','{version}','{{\"destination\":\"Racing edit\"}}');") == ''
        assert apply(a, "planned", '{"days":[],"overview":"revised"}') == 't'
        assert sql(f"SELECT COALESCE(preferences->>'planNeedsRefresh','false') FROM trips WHERE id='{trip}';") == 'false'
        # NOW() is transaction-stable: without replacing the legacy trigger, both
        # edits below share a revision and the stale second write is accepted.
        sql(f"""
        BEGIN;
        SET LOCAL ROLE service_role;
        DO $$$$ DECLARE v TIMESTAMPTZ; first_version TIMESTAMPTZ; changed INTEGER;
        BEGIN
          SELECT updated_at INTO v FROM trips WHERE id='{trip}';
          SELECT updated_at INTO first_version FROM update_trip_brief('{trip}','{owner}',v,'{{"destination":"Initial transaction edit"}}');
          IF first_version <= v THEN RAISE EXCEPTION 'Revision did not advance'; END IF;
          SELECT count(*) INTO changed FROM update_trip_brief('{trip}','{owner}',first_version,'{{"destination":"Accepted transaction edit"}}');
          IF changed <> 1 THEN RAISE EXCEPTION 'Fresh revision rejected'; END IF;
          SELECT count(*) INTO changed FROM update_trip_brief('{trip}','{owner}',first_version,'{{"destination":"Stale transaction edit"}}');
          IF changed <> 0 THEN RAISE EXCEPTION 'Transaction-stable timestamp accepted stale revision'; END IF;
          IF (SELECT updated_at FROM trips WHERE id='{trip}') <= first_version THEN RAISE EXCEPTION 'Revision did not strictly advance'; END IF;
        END $$$$;
        ROLLBACK;
        """.replace('$$$$', '$$'))
        print("PASS existing timestamp trigger cannot collapse consecutive revisions in one transaction")
        print("PASS brief revision conflicts, generation lock, revoked sharing, preserved old plan and revised publication")

    checkout_migration = root / "supabase/migrations/20261003006000_version_checkout_handoffs.sql"
    if checkout_migration.exists():
        sql(checkout_migration.read_text()); sql(checkout_migration.read_text())
        version = sql(f"SELECT updated_at FROM trips WHERE id='{trip}';")
        handoff = f"SELECT prepare_trip_handoff('{trip}','{owner}','{version}','checkout-test','activity_v_123P1@2099-06-01','Walk','https://www.viator.com/test');"
        sql(auth + handoff, ok=False)
        assert sql('SET ROLE service_role; ' + handoff) == 't'
        assert sql('SET ROLE service_role; ' + handoff) == 't'
        assert sql('SELECT count(*) FROM affiliate_clicks;') == '1'
        assert sql(f"SET ROLE service_role; SELECT id FROM update_trip_brief('{trip}','{owner}','{version}','{{\"destination\":\"Lisbon\"}}');") == trip
        assert sql('SET ROLE service_role; ' + handoff) == 'f'
        assert sql('SET ROLE service_role; ' + handoff.replace('checkout-test', 'checkout-late')) == 'f'
        assert sql('SELECT count(*) FROM affiliate_clicks;') == '1'
        print("PASS atomic checkout publication rejects changed brief, replay and late provider results")

    plan_migration = root / "supabase/migrations/20261003007000_revision_safe_plan_edits.sql"
    if plan_migration.exists():
        sql("CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.sub',TRUE)::UUID $$; GRANT USAGE ON SCHEMA auth TO authenticated;")
        sql(plan_migration.read_text()); sql(plan_migration.read_text())
        sql(f"UPDATE trips SET status='generating',search_id='{a}' WHERE id='{trip}';")
        initial_days = [{"dayNumber":1,"date":"2099-06-01","morning":{"activities":[{"id":"walk","name":"Walk"}]},"afternoon":{"activities":[{"id":"museum","name":"Museum"}]}}]
        payload = json.dumps({"days":initial_days,"overview":"Plan to edit"})
        assert sql(f"SET ROLE service_role; SELECT apply_trip_generation_update('{trip}','{a}','planned','{payload}');") == 't'
        sql(f"SET ROLE service_role; UPDATE itineraries SET days='[]' WHERE trip_id='{trip}';",ok=False)
        sql(f"GRANT SELECT,UPDATE,DELETE ON itineraries TO authenticated;")
        sql(auth + f"UPDATE itineraries SET days='[]' WHERE trip_id='{trip}';",ok=False)
        days = json.loads(sql(f"SELECT stamp_plan_items('{trip}',days) FROM itineraries WHERE trip_id='{trip}';"))
        first = days[0]['morning']['activities'][0]['planItemId']; second = days[0]['afternoon']['activities'][0]['planItemId']
        def edit_command(action, item=first, other_item=None):
            result = {'requestId':str(uuid.uuid4()),'expectedUpdatedAt':sql(f"SELECT updated_at FROM trips WHERE id='{trip}';"),'expectedPlanRevision':sql(f"SELECT plan_revision_id FROM trips WHERE id='{trip}';") or None,'action':action,'itemId':item}
            if other_item: result['otherItemId']=other_item
            return result
        def edit(command, snapshot, locks):
            return json.loads(sql(f"SET ROLE service_role; SELECT edit_trip_plan('{trip}','{owner}','{json.dumps(command)}','{json.dumps(snapshot)}',ARRAY{json.dumps(locks).replace(chr(34),chr(39))}::TEXT[]);"))
        lock_command = edit_command('lock')
        assert edit(lock_command,days,[first])['state']=='applied'
        assert edit(lock_command,days,[first])['state']=='replayed'
        assert sql("SELECT count(*) FROM trip_plan_revisions;")=='2'
        swap_command = edit_command('swap',first,second)
        swapped=json.loads(json.dumps(days)); swapped[0]['morning']['activities'][0],swapped[0]['afternoon']['activities'][0]=swapped[0]['afternoon']['activities'][0],swapped[0]['morning']['activities'][0]
        swapped[0]['morning']['activities'][0]['timeOfDay']='morning'; swapped[0]['afternoon']['activities'][0]['timeOfDay']='afternoon'
        swapped[0].update({'title':'Day 1','summary':'Schedule updated. Check travel times and opening hours.','tips':[]})
        assert edit(swap_command,swapped,[first])['state']=='conflict'
        assert edit(edit_command('unlock'),days,[])['state']=='applied'
        assert edit(swap_command,swapped,[])['state']=='conflict' # stale parent
        swap_command=edit_command('swap',first,second)
        assert edit(swap_command,swapped,[])['state']=='applied'
        assert sql(f"SELECT days->0->'morning'->'activities'->0->>'name' FROM itineraries WHERE trip_id='{trip}';")=='Museum'
        assert sql(f"SELECT count(*) FROM trip_plan_revisions WHERE days->0->'morning'->'activities'->0->>'name'='Walk';")=='3'
        sql("UPDATE trip_plan_revisions SET days='[]';",ok=False)
        sql(auth + "SELECT count(*) FROM trip_plan_revisions;",ok=False)
        race1=edit_command('lock',first); race2=edit_command('lock',second)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            jobs=[pool.submit(edit,race1,swapped,[first]),pool.submit(edit,race2,swapped,[second])]
            assert sorted(job.result()['state'] for job in jobs)==['applied','conflict']
        sql(auth + f"SELECT edit_trip_plan('{trip}','{owner}','{{}}','[]','{{}}');",ok=False)
        sql(auth + f"UPDATE trips SET plan_revision_id=gen_random_uuid() WHERE id='{trip}';",ok=False)
        sql(f"SET ROLE service_role; UPDATE trips SET plan_revision_id=gen_random_uuid() WHERE id='{trip}';",ok=False)
        stale_command=edit_command('lock')
        version=sql(f"SELECT updated_at FROM trips WHERE id='{trip}';")
        sql(f"SET ROLE service_role; SELECT id FROM update_trip_brief('{trip}','{owner}','{version}','{{\"destination\":\"Oslo\"}}');")
        assert edit(stale_command,swapped,[first])['state']=='conflict'
        sql(f"UPDATE trips SET status='generating',search_id='{b}' WHERE id='{trip}';")
        assert sql(f"SET ROLE service_role; SELECT apply_trip_generation_update('{trip}','{b}','planned','{payload}');")=='t'
        assert sql(f"SELECT plan_revision_id IS NULL FROM trips WHERE id='{trip}';")=='t'
        print("PASS immutable plan history, server-only writes, locked swaps, exact replay, stale parents/briefs and new generation lineage")

finally:
    subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
