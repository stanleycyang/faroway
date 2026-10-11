"""Build a deterministic staging-only approval artifact. Does not execute SQL."""
import argparse,hashlib,json
from pathlib import Path
from staging.bundle import render,TARGET,ROOT,SUPPLEMENTS
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project-ref',required=True)
parser.add_argument('--output-dir',type=Path,required=True)
args=parser.parse_args()
source=render(args.project_ref)
args.output_dir.mkdir(parents=True,exist_ok=True)
(args.output_dir/'bootstrap.sql').write_text(source)
receipt={'target_project_ref':TARGET,'release_head':'39e18f4049413f9c47b71da2bbf74e587352b7c9','bootstrap_sha256':hashlib.sha256(source.encode()).hexdigest(),'supplements':{name:hashlib.sha256((ROOT/'supabase/staging'/name).read_bytes()).hexdigest() for name in SUPPLEMENTS},'manifest_sha256':hashlib.sha256((ROOT/'supabase/staging/manifest.json').read_bytes()).hexdigest(),'network_or_sql_executed':False}
(args.output_dir/'approval.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
