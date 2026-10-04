"""Review candidate only: networkless disposable PG; never external SQL."""
from pathlib import Path
import subprocess,time,uuid,concurrent.futures
ROOT=Path(__file__).resolve().parents[1]
IMAGE='postgres:17.11-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
name='faroway-release-'+uuid.uuid4().hex[:10]
def sql(text,ok=True):
    r=subprocess.run(['docker','exec','-i',name,'psql','-h','127.0.0.1','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'],input=text,text=True,capture_output=True)
    if ok and r.returncode: raise AssertionError(r.stderr)
    if not ok: assert r.returncode, 'Expected rejection'
    return r.stdout.strip()
A='00000000-0000-4000-8000-000000000011';B='00000000-0000-4000-8000-000000000012'
T='00000000-0000-4000-8000-000000000013';S='00000000-0000-4000-8000-000000000014'
token='ExpoPushToken[synthetic_registration]'
def consent(user,rev,on=True):
    return sql(f"SET ROLE service_role; SELECT public.set_device_push_consent('{user}','{token}',{rev},{str(on).lower()},'ios');")
try:
    subprocess.run(['docker','run','--detach','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE],check=True,stdout=subprocess.DEVNULL)
    for _ in range(80):
        if subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
        time.sleep(.25)
    else:raise AssertionError('Local PostgreSQL unavailable')
    sql((ROOT/'scripts/staging/platform-fixture.sql').read_text())
    sql((ROOT/'supabase/staging/approval/bootstrap.sql').read_text())
    sql(f"INSERT INTO auth.users(id,email) VALUES('{A}','a@example.invalid'),('{B}','b@example.invalid'); INSERT INTO public.users(id,email,auth_provider) VALUES('{A}','a@example.invalid','apple'),('{B}','b@example.invalid','email') ON CONFLICT(id) DO NOTHING;")
    sql(f"INSERT INTO public.push_tokens(user_id,token,platform) VALUES('{A}','{token}','ios'),('{B}','{token}','ios');")
    sql((ROOT/'supabase/release-candidate/account-and-push.sql').read_text())
    assert sql(f"SELECT count(*) FROM public.push_tokens WHERE token='{token}'")=='0'
    for role in ['anon','authenticated']:
        sql(f"SET ROLE {role}; SELECT * FROM public.account_deletion_receipts;",False)
        sql(f"SET ROLE {role}; SELECT public.set_device_push_consent('{A}','{token}',1,true,'ios');",False)
        sql(f"SET ROLE {role}; SELECT public.claim_account_deletion('{A}','{'a'*64}','{T}');",False)
    assert consent(A,100)=='t'
    assert consent(B,101)=='f'
    assert consent(A,102,False)=='t'
    assert consent(A,101)=='f' # late timed-out POST cannot resurrect opt-out
    assert consent(B,103)=='t'
    assert consent(A,104,False)=='f' # old account cannot revoke new owner
    assert sql(f"SELECT user_id FROM public.push_tokens WHERE token='{token}'")==B
    assert consent(B,105,False)=='t'
    assert consent(A,106)=='t'
    # Exercise transaction ordering with concurrent requests; highest revision wins.
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda r:consent(A,r,r!=120),[110,115,119,120]))
    assert sql(f"SELECT operation_revision||':'||is_active FROM public.push_tokens WHERE token='{token}'")=='120:false'
    print('PASS ownership uniqueness, cross-account refusal, concurrent ordering and timeout/opt-out tombstones',flush=True)
    sql(f"UPDATE public.users SET notification_settings='{{\"itinerary_updates\":true}}' WHERE id='{A}';")
    sql(f"INSERT INTO public.trips(id,user_id,destination,start_date,end_date,status) VALUES('{T}','{A}','Test','2099-01-01','2099-01-02','draft'); INSERT INTO public.searches(id,user_id,destination,start_date,end_date,status) VALUES('{S}','{A}','Test','2099-01-01','2099-01-02','pending'); UPDATE public.trips SET status='generating',search_id='{S}' WHERE id='{T}'; SELECT public.apply_trip_generation_update('{T}','{S}','planned','{{\"days\":[],\"total_cost\":0}}');")
    assert consent(A,130)=='t'
    claim=f"SET ROLE service_role; SELECT public.claim_itinerary_push('{T}','{S}') IS NOT NULL;"
    assert sql(claim)=='f' # legacy default true is NOT consent
    sql(f"UPDATE public.users SET notification_consent_version='notifications-v2' WHERE id='{A}';")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda _:sql(claim),range(2)))
    assert sorted(results)==['f','t']
    assert sql(f"SELECT public.claim_itinerary_push('{T}','{B}') IS NULL")=='t'
    print('PASS explicit category/device consent, stale generation exclusion and single dispatch claim',flush=True)
    # Hold an insertion open after its trigger: deletion must wait, so its later
    # snapshot includes this search. Use pg_stat_activity to prove overlap.
    late=str(uuid.uuid4())
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        writer=pool.submit(sql,f"BEGIN; SET application_name='deletion-writer'; INSERT INTO public.searches(id,user_id,destination,start_date,end_date,status) VALUES('{late}','{B}','Late','2099-01-01','2099-01-02','pending'); SELECT pg_sleep(2); COMMIT;")
        for _ in range(100):
            if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='deletion-writer' AND wait_event='PgSleep'")=='1':break
            time.sleep(.02)
        else:raise AssertionError('Writer did not reach overlap barrier')
        deletion=pool.submit(sql,f"SELECT count(*) FROM public.claim_account_deletion('{B}','{'c'*64}','{uuid.uuid4()}');")
        time.sleep(.1)
        assert not deletion.done(), 'Deletion claim bypassed in-flight write'
        writer.result(); assert deletion.result()=='1'
    assert sql(f"SELECT count(*) FROM public.searches WHERE id='{late}' AND user_id='{B}'")=='1'
    sql(f"INSERT INTO public.searches(user_id,destination,start_date,end_date,status) VALUES('{B}','Blocked','2099-01-01','2099-01-02','pending');",False)
    sql(f"UPDATE public.searches SET user_id=NULL WHERE id='{late}'",False)
    sql(f"DELETE FROM public.searches WHERE user_id='{B}'; DELETE FROM public.users WHERE id='{B}'; DELETE FROM auth.users WHERE id='{B}';")
    assert sql(f"SELECT count(*) FROM public.searches WHERE id='{late}'")=='0'
    print('PASS in-flight insertion serialization, late-write rejection and no detached search after Auth deletion',flush=True)
    lease1=uuid.uuid4();lease2=uuid.uuid4()
    claim=f"SET ROLE service_role; SELECT count(*) FROM public.claim_account_deletion('{A}','{'a'*64}','{lease1}');"
    assert sql(claim)=='1'
    assert sql(f"SET ROLE service_role; SELECT count(*) FROM public.claim_account_deletion('{A}','{'b'*64}','{lease2}');")=='0'
    sql(f"UPDATE public.users SET display_name='blocked' WHERE id='{A}'",False)
    sql(f"UPDATE public.trips SET destination='blocked' WHERE id='{T}'",False)
    assert consent(A,200)=='f'
    sql(f"UPDATE public.account_deletion_receipts SET lease_until=now()-interval '1 second' WHERE user_id='{A}'")
    assert sql(f"SET ROLE service_role; SELECT count(*) FROM public.claim_account_deletion('{A}','{'b'*64}','{lease2}');")=='1'
    assert sql(f"WITH changed AS (UPDATE public.account_deletion_receipts SET phase='completed' WHERE user_id='{A}' AND lease_id='{lease1}' RETURNING *) SELECT count(*) FROM changed")=='0'
    sql(f"DELETE FROM public.trips WHERE user_id='{A}'; DELETE FROM public.searches WHERE user_id='{A}';")
    sql(f"DELETE FROM public.users WHERE id='{A}'; DELETE FROM auth.users WHERE id='{A}';")
    assert sql(f"SELECT count(*) FROM public.account_deletion_receipts WHERE user_id='{A}'")=='1'
    print('PASS private durable deletion receipts, lease fencing, write refusal and survival after Auth deletion',flush=True)
finally:
    subprocess.run(['docker','rm','--force',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
