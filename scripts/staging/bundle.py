"""Render only: no database/network/credential interface."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[2]
TARGET='omovikloadpvzijoaqus'
SUPPLEMENTS=['guard.sql','permissions.sql','synthetic-content.sql','postconditions.sql']

def render(project_ref):
    if project_ref!=TARGET: raise ValueError('Only the approved staging project identity may be rendered')
    manifest=json.loads((ROOT/'supabase/staging/manifest.json').read_text())
    assert manifest['target_project_ref']==TARGET
    expected={entry['path'] for entry in manifest['migrations']}
    followups=json.loads((ROOT/'supabase/release-candidate/migrations.json').read_text())['application_order']
    for entry in followups:
        data=(ROOT/entry['path']).read_bytes()
        if hashlib.sha256(data).hexdigest()!=entry['sha256'] or data!=(ROOT/entry['source']).read_bytes():
            raise ValueError('Unreviewed follow-up migration: '+entry['path'])
    actual={str(p.relative_to(ROOT)) for p in (ROOT/'supabase/migrations').glob('*.sql')}
    if actual!=expected | {entry['path'] for entry in followups}: raise ValueError('Migration inventory changed; review and pin a new manifest')
    pieces=['-- STAGING APPROVAL BUNDLE ONLY: '+TARGET+'\n-- Execute only after target identity and explicit SQL approval are verified.\nBEGIN;\n']
    pieces.append((ROOT/'supabase/staging/guard.sql').read_text())
    for entry in manifest['migrations']:
        source=(ROOT/entry['path']).read_bytes()
        if hashlib.sha256(source).hexdigest()!=entry['sha256']: raise ValueError('Unreviewed source change: '+entry['path'])
        if entry['action']=='exclude': continue
        text=source.decode()
        # Exactly one historical file wraps itself in BEGIN/COMMIT. Move that
        # boundary to the single outer transaction to avoid partial public RPCs.
        if entry['path'].endswith('20260221000000_supabase_best_practices.sql'):
            if len(re.findall(r'^BEGIN;$',text,re.M))!=1 or len(re.findall(r'^COMMIT;$',text,re.M))!=1: raise ValueError('Unexpected transaction layout')
            text=re.sub(r'^(?:BEGIN|COMMIT);\s*$', '', text, flags=re.M)
        elif re.search(r'^(?:BEGIN|COMMIT);\s*$',text,re.M):
            raise ValueError('Unexpected migration transaction boundary')
        pieces.append('\n-- SOURCE '+entry['path']+' SHA256 '+entry['sha256']+'\n'+text)
    for name in SUPPLEMENTS[1:]:
        pieces.append('\n-- STAGING SUPPLEMENT '+name+'\n'+(ROOT/'supabase/staging'/name).read_text())
    pieces.append("\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\n")
    bundle='\n'.join(line.rstrip() for line in '\n'.join(pieces).splitlines())+'\n'
    if 'jcnephijkxgtprsutgsf' in bundle: raise ValueError('Production reference in rendered SQL')
    return bundle
