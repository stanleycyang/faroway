"""Rehearse creation recovery after the frozen bootstrap; disposable networkless SQL only."""
from pathlib import Path
import concurrent.futures
import json
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
IMAGE = 'postgres:17.11-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
name = 'faroway-creation-' + uuid.uuid4().hex[:10]
owner = '00000000-0000-4000-8000-000000000011'
other = '00000000-0000-4000-8000-000000000012'
trip = '00000000-0000-4000-8000-000000000013'

def sql(source, ok=True):
    result = subprocess.run(['docker', 'exec', '-i', name, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], input=source, text=True, capture_output=True)
    if ok and result.returncode:
        raise AssertionError(result.stderr)
    if not ok:
        assert result.returncode, 'Expected rejection'
    return result.stdout.strip()

def create(identity=trip, account=owner, destination='Paris', fingerprint='a'*64, travelers=2, ok=True):
    body = json.dumps({'id': identity, 'destination': destination, 'start_date': '2099-06-01', 'end_date': '2099-06-03', 'travelers': travelers, 'budget_tier': 'moderate', 'vibes': [], 'preferences': {'creationRequestHash': fingerprint}})
    result = sql(f"SET ROLE service_role; SELECT create_trip_once('{account}', '{identity}', '{body}'::jsonb);", ok)
    return json.loads(result) if ok else None

try:
    subprocess.run(['docker', 'run', '--detach', '--rm', '--network', 'none', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE], check=True, stdout=subprocess.DEVNULL)
    for _ in range(80):
        if subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            break
        time.sleep(.25)
    else:
        raise AssertionError('Local PostgreSQL unavailable')
    sql((ROOT/'scripts/staging/platform-fixture.sql').read_text())
    sql((ROOT/'supabase/staging/approval/bootstrap.sql').read_text())
    sql(f"INSERT INTO auth.users(id,email) VALUES('{owner}','owner@example.invalid'),('{other}','other@example.invalid');")
    # Historical keyed creation must be adopted even after an edited brief.
    legacy = str(uuid.uuid4())
    sql(f"INSERT INTO trips(id,user_id,destination,start_date,end_date,preferences) VALUES('{legacy}','{owner}','Edited Rome','2099-06-01','2099-06-03','{{\"creationRequestHash\":\"{'b'*64}\"}}');")
    sql((ROOT/'supabase/release-candidate/trip-creation-recovery.sql').read_text())
    assert create(legacy, fingerprint='b'*64)['trip']['destination'] == 'Edited Rome'
    print('PASS adoption of existing keyed identities without rewriting edited trips', flush=True)
    for role in ['anon', 'authenticated']:
        sql(f"SET ROLE {role}; SELECT * FROM trip_creation_requests;", False)
        sql(f"SET ROLE {role}; SELECT create_trip_once('{owner}','{trip}','{{}}');", False)
    sql('SET ROLE service_role; DELETE FROM trip_creation_requests;', False)
    print('PASS client table/RPC denial and service-only atomic mutation', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        outcomes = list(pool.map(lambda _:create()['outcome'], range(4)))
    assert sorted(outcomes) == ['created', 'replayed', 'replayed', 'replayed']
    assert create(fingerprint='c'*64)['outcome'] == 'key_conflict'
    create(account=other, ok=False)
    sql(f"SET ROLE service_role; SELECT update_trip_brief('{trip}','{owner}',(SELECT updated_at FROM trips WHERE id='{trip}'),'{{\"destination\":\"Tokyo\"}}');")
    assert create()['trip']['destination'] == 'Tokyo'
    sql(f"DELETE FROM trips WHERE id='{trip}';")
    assert create()['outcome'] == 'gone'
    assert sql(f"SELECT count(*) FROM trips WHERE id='{trip}';") == '0'
    print('PASS concurrent replay, changed-input/cross-owner rejection, current-state replay and deleted-trip tombstones', flush=True)
    fresh = str(uuid.uuid4())
    # Failed trip insertion rolls the identity back with it.
    create(fresh, travelers=0, ok=False)
    assert sql(f"SELECT count(*) FROM trip_creation_requests WHERE request_key='{fresh}';") == '0'
    assert create(fresh)['outcome'] == 'created'
    sql((ROOT/'supabase/release-candidate/account-and-push.sql').read_text())
    deleting = str(uuid.uuid4())
    sql(f"SELECT claim_account_deletion('{owner}','{'d'*64}','{deleting}');")
    create(str(uuid.uuid4()), ok=False)
    sql(f"DELETE FROM auth.users WHERE id='{owner}';")
    assert sql(f"SELECT count(*) FROM trip_creation_requests WHERE user_id='{owner}';") == '0'
    print('PASS failed-insert rollback, deletion write fence and account cascade cleanup', flush=True)
finally:
    subprocess.run(['docker','rm','-f',name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
