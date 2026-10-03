"""Run draft migrations against disposable real Postgres. No ports/volumes/secrets."""
from pathlib import Path
import concurrent.futures
import subprocess
import time
import uuid

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
        if subprocess.run(["docker", "exec", name, "pg_isready", "-U", "postgres"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0: break
        time.sleep(.25)
    else: raise AssertionError("Local Postgres did not become ready")
    sql("""
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE searches (id UUID PRIMARY KEY, user_id UUID);
    CREATE TABLE trips (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, destination TEXT, start_date DATE, end_date DATE, status TEXT DEFAULT 'draft', search_id UUID REFERENCES searches(id) ON DELETE SET NULL, itinerary_id UUID, is_shared BOOLEAN DEFAULT FALSE, share_token TEXT, shared_at TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE itineraries (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), trip_id UUID REFERENCES trips(id), user_id UUID, destination TEXT, start_date DATE, end_date DATE, overview TEXT, total_cost JSONB, days JSONB, packing_list TEXT[], general_tips TEXT[], generated_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE workflow_progress (trip_id UUID PRIMARY KEY REFERENCES trips(id), user_id UUID, step TEXT, progress INTEGER CHECK(progress BETWEEN 0 AND 100), message TEXT, updated_at TIMESTAMPTZ);
    CREATE TABLE notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, type TEXT, title TEXT, message TEXT, data JSONB, read BOOLEAN);
    ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_access ON trips TO authenticated USING (user_id::TEXT = current_setting('request.jwt.claim.sub', TRUE)) WITH CHECK (user_id::TEXT = current_setting('request.jwt.claim.sub', TRUE));
    GRANT SELECT, INSERT, UPDATE, DELETE ON trips TO authenticated;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    """)
    for migration in ["20261003001000_fence_trip_generation.sql", "20261003002000_protect_trip_lifecycle.sql"]:
        script = (root / "supabase/migrations" / migration).read_text()
        sql(script); sql(script)  # Reapplication is safe.
    sql(f"INSERT INTO searches VALUES ('{a}','{owner}'), ('{b}','{owner}'), ('{foreign}','{other}'); INSERT INTO trips(id,user_id,destination,start_date,end_date) VALUES ('{trip}','{owner}','Paris','2099-06-01','2099-06-03');")
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
    print("PASS overlapping new claim and old completion serialize on the row lock")
finally:
    subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
