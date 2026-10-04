"""Full repository migration rehearsal; only disposable networkless PostgreSQL.
No connection strings, external SQL, Supabase keys, or application environment.
"""
from pathlib import Path
import hashlib,json,subprocess,time,uuid
from staging.assertions import verify
from staging.bundle import render,TARGET
ROOT=Path(__file__).resolve().parents[1]
IMAGE='postgres:17.11-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
name='faroway-staging-test-'+uuid.uuid4().hex[:10]
database='postgres'
def sql(text,ok=True):
    result=subprocess.run(['docker','exec','-i',name,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],input=text,text=True,capture_output=True)
    if ok and result.returncode: raise AssertionError(result.stderr)
    if not ok: assert result.returncode, 'Expected rejection'
    return result.stdout.strip()
try:
    subprocess.run(['docker','run','--detach','--rm','--network','none','--name',name,'-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE],check=True,stdout=subprocess.DEVNULL)
    for _ in range(80):
        if subprocess.run(['docker','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:break
        time.sleep(.25)
    else:raise AssertionError('Local PostgreSQL unavailable')
    sql((ROOT/'scripts/staging/platform-fixture.sql').read_text())
    sql((ROOT/'supabase/staging/guard.sql').read_text())
    manifest=json.loads((ROOT/'supabase/staging/manifest.json').read_text())
    applied=[]
    for entry in manifest['migrations']:
        source=ROOT/entry['path']
        assert hashlib.sha256(source.read_bytes()).hexdigest()==entry['sha256'],entry['path']
        if entry['action']=='exclude':continue
        try:sql(source.read_text())
        except AssertionError as error:raise AssertionError(entry['path']+'\n'+str(error)) from error
        applied.append(source.name)
    print('PASS all '+str(len(applied))+' exact repository migrations on '+sql('SHOW server_version;'),flush=True)
    verify(sql,ROOT)
    sql((ROOT/'supabase/staging/guard.sql').read_text(),ok=False)
    print('PASS fresh-install guard refuses an already populated application schema',flush=True)
    sql('CREATE DATABASE bundle_replay;')
    database='bundle_replay'
    platform=(ROOT/'scripts/staging/platform-fixture.sql').read_text()
    # Cluster roles/extension schema defaults already exist only in first DB.
    platform=platform.replace('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;','').replace('CREATE ROLE service_role NOLOGIN BYPASSRLS;','')
    sql(platform.replace('ALTER DATABASE postgres','ALTER DATABASE bundle_replay'))
    bundled=render(TARGET)
    assert bundled==render(TARGET)
    assert bundled==(ROOT/'supabase/staging/approval/bootstrap.sql').read_text()
    receipt=json.loads((ROOT/'supabase/staging/approval/approval.json').read_text())
    assert receipt['bootstrap_sha256']==hashlib.sha256(bundled.encode()).hexdigest()
    try: render('jcnephijkxgtprsutgsf')
    except ValueError: pass
    else: raise AssertionError('Production target accepted by renderer')
    sql(bundled)
    verify(sql,ROOT,bootstrap_complete=True)
    sql(bundled,ok=False)
    print('PASS deterministic single-transaction bundle, target refusal and full functional/security matrix replay',flush=True)
finally:
    subprocess.run(['docker','rm','--force',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
