"""Private evidence and brief edits against disposable, networkless PostgreSQL."""
from pathlib import Path
import hashlib
import json
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
IMAGE = 'postgres:17.11-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
name = 'faroway-evidence-' + uuid.uuid4().hex[:10]
owner = '00000000-0000-4000-8000-000000000011'
other = '00000000-0000-4000-8000-000000000012'
trip = '10000000-0000-4000-8000-000000000011'

def sql(source, ok=True):
    result = subprocess.run(['docker', 'exec', '-i', name, 'psql', '-h', '127.0.0.1', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], input=source, text=True, capture_output=True)
    if ok and result.returncode: raise AssertionError(result.stderr)
    if not ok and not result.returncode: raise AssertionError('Expected rejection')
    return result.stdout.strip()

try:
    subprocess.run(['docker', 'run', '--detach', '--rm', '--network', 'none', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', IMAGE], check=True, stdout=subprocess.DEVNULL)
    for _ in range(80):
        if subprocess.run(['docker', 'exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0: break
        time.sleep(.25)
    else: raise AssertionError('Local PostgreSQL unavailable')
    sql((ROOT / 'scripts/staging/platform-fixture.sql').read_text())
    sql((ROOT / 'supabase/staging/approval/bootstrap.sql').read_text())
    manifest = json.loads((ROOT / 'supabase/release-candidate/migrations.json').read_text())
    for entry in manifest['application_order']:
        data = (ROOT / entry['path']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry['sha256']
        sql(data.decode())
    sql(f"INSERT INTO auth.users(id,email) VALUES ('{owner}','owner@fixture.invalid'), ('{other}','other@fixture.invalid');")
    sql(f"INSERT INTO public.trips(id,user_id,destination,start_date,end_date,travelers,status,preferences) VALUES ('{trip}','{owner}','Paris','2099-01-01','2099-01-02',2,'planned','{{}}');")
    sql(f'''INSERT INTO public.itineraries(trip_id,user_id,days) VALUES ('{trip}','{owner}', '[{{"morning":{{"activities":[{{"id":"venue-1","name":"Museum"}}],"meals":[]}},"afternoon":{{"activities":[],"meals":[]}},"evening":{{"activities":[],"meals":[]}}}}]'::jsonb);''')
    brief_rev = sql(f"SELECT updated_at FROM public.trips WHERE id='{trip}';")
    sql(f"INSERT INTO public.trip_venue_evidence(trip_id,user_id,trip_revision,venue_id,requirement,status,note) VALUES ('{trip}','{owner}','{brief_rev}','venue-1','step_free_entrance','confirmed','Legacy matching report'), ('{trip}','{owner}','2000-01-01','venue-1','dietary','confirmed','Legacy stale report');")
    sql((ROOT / 'supabase/migrations/20261028044644_stable_venue_evidence_context.sql').read_text())
    assert sql("SELECT count(*) FROM public.trip_venue_evidence WHERE evidence_revision IS NOT NULL;") == '1'
    assert sql("SELECT count(*) FROM public.trip_venue_evidence WHERE evidence_revision IS NULL;") == '1'
    rev = sql(f"SELECT public.trip_venue_evidence_context('{trip}','{owner}');")
    assert sql(f"SET TIME ZONE 'America/Los_Angeles'; SELECT public.trip_venue_evidence_context('{trip}','{owner}');") == rev
    sql(f"SET ROLE service_role; SELECT public.save_trip_venue_evidence('{trip}','{owner}','{brief_rev}','venue-1','dietary','confirmed','Old caller');", False)
    sql(f"SET ROLE service_role; SELECT public.read_trip_venue_evidence('{trip}','{owner}','2000-01-01');", False)
    call = lambda who, version, venue, note: f"SELECT count(*) FROM public.save_trip_venue_evidence_v2('{trip}','{who}','{version}','{venue}','step_free_entrance','confirmed','{note}');"
    assert sql('SET ROLE service_role; ' + call(owner, rev, 'venue-1', 'Spoke with staff')) == '1'
    sql('SET ROLE service_role; ' + call(other, rev, 'venue-1', 'Spoke with staff'), False)
    sql('SET ROLE service_role; ' + call(owner, rev, 'missing-venue', 'Spoke with staff'), False)
    sql('SET ROLE service_role; ' + call(owner, rev, 'venue-1', ''), False)
    for role in ['anon', 'authenticated']:
        sql(f'SET ROLE {role}; SELECT * FROM public.trip_venue_evidence;', False)
        sql(f'SET ROLE {role}; ' + call(owner, rev, 'venue-1', 'Forged'), False)
    read = lambda who: sql(f"SET ROLE service_role; SELECT public.read_trip_venue_evidence('{trip}','{who}');")
    assert json.loads(read(owner))['evidence'][0]['note'] == 'Spoke with staff'
    assert read(other) == ''
    for shared in ['true', 'false', 'true', 'false']:
        sql(f"UPDATE public.trips SET is_shared={shared}, share_token=CASE WHEN {shared} THEN 'fixture-link' ELSE NULL END WHERE id='{trip}';")
        current = json.loads(read(owner))
        assert current['evidenceRevision'] == rev
        assert len(current['evidence']) == 1
        assert sql('SET ROLE service_role; ' + call(owner, rev, 'venue-1', 'Still valid after sharing')) == '1'
    for role in ['anon', 'authenticated']:
        sql(f"SET ROLE {role}; SELECT public.read_trip_venue_evidence('{trip}','{owner}');", False)
        sql(f"SET ROLE {role}; SELECT public.trip_venue_evidence_context('{trip}','{owner}');", False)
    # Itinerary content and regeneration identity invalidate previous reports.
    sql(f"UPDATE public.itineraries SET days=jsonb_set(days, '{{0,morning,activities,0,name}}', '\"Changed museum\"') WHERE trip_id='{trip}';")
    assert json.loads(read(owner))['evidence'] == []
    sql('SET ROLE service_role; ' + call(owner, rev, 'venue-1', 'Stale content'), False)
    rev = json.loads(read(owner))['evidenceRevision']
    assert sql('SET ROLE service_role; ' + call(owner, rev, 'venue-1', 'New content')) == '1'
    sql(f"UPDATE public.itineraries SET generated_at=clock_timestamp() WHERE trip_id='{trip}';")
    assert json.loads(read(owner))['evidence'] == []
    sql('SET ROLE service_role; ' + call(owner, rev, 'venue-1', 'Stale generation'), False)
    rev = json.loads(read(owner))['evidenceRevision']
    assert sql('SET ROLE service_role; ' + call(owner, rev, 'venue-1', 'Current generation')) == '1'
    brief_rev = sql(f"SELECT updated_at FROM public.trips WHERE id='{trip}';")
    changes = '{"preferences":{"flightSearch":{"childAges":[5],"consentVersion":"flight-search-duffel-v1"},"requirements":{"allergies":["peanut"],"dietaryPreferences":[],"accessibility":[],"mobilityNotes":""}}}'
    assert sql(f"SET ROLE service_role; SELECT count(*) FROM public.update_trip_brief('{trip}','{owner}','{brief_rev}','{changes}'::jsonb);") == '1'
    assert sql(f"SELECT preferences->'flightSearch'->'childAges'->>0 FROM public.trips WHERE id='{trip}';") == '5'
    assert sql(f"SELECT preferences->'requirements'->'allergies'->>0 FROM public.trips WHERE id='{trip}';") == 'peanut'
    sql('SET ROLE service_role; ' + call(owner, rev, 'venue-1', 'Stale'), False)
    sql(f"SET ROLE service_role; SELECT public.read_trip_venue_evidence('{trip}','{owner}');", False)
    sql(f"UPDATE public.trips SET status='generating' WHERE id='{trip}'; UPDATE public.trips SET status='planned' WHERE id='{trip}';")
    assert json.loads(read(owner))['evidence'] == []
    print('PASS ownership, sharing stability, plan/regeneration/requirements invalidation and permissions')
finally:
    subprocess.run(['docker', 'rm', '--force', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
