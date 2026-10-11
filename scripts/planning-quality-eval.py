"""Offline rubric calibration on synthetic plans; never calls a model or provider.
Usage: python scripts/planning-quality-eval.py [fixtures.json] [results.json]
This measures whether the rubric detects known fixture failures, not live AI quality.
"""
from datetime import datetime
from pathlib import Path
import json
import sys


def evaluate(case):
    brief, plan = case['brief'], case['plan']
    activities = plan['activities']
    checks = {}
    checks['dates_and_party'] = plan['dates'] == brief['dates'] and plan['party'] == brief['party']
    checks['interest_coverage'] = set(brief['interests']).issubset({tag for a in activities for tag in a['tags']})
    checks['pace_and_time'] = all(
        sum(a['date'] == day for a in activities) <= brief['max_activities_per_day']
        and all(a['start_minutes'] >= brief['earliest_start_minutes'] for a in activities if a['date'] == day)
        for day in brief['dates']
    ) and all(a['date'] in brief['dates'] for a in activities)
    checks['accessibility_evidence'] = not brief['step_free'] or all(
        a.get('step_free') is True and bool(a.get('accessibility_evidence')) for a in activities
    )
    checks['dietary_evidence'] = all(
        set(brief['diet']).issubset(set(a.get('diet', []))) and bool(a.get('diet_evidence'))
        for a in activities if a['kind'] == 'meal'
    )
    checks['schedule_feasibility'] = True
    for day in brief['dates']:
        ordered = sorted((a for a in activities if a['date'] == day), key=lambda a: a['start_minutes'])
        for before, after in zip(ordered, ordered[1:]):
            if after['start_minutes'] < before['end_minutes'] + after['transfer_minutes']:
                checks['schedule_feasibility'] = False
    prices = [a['price'] for a in activities]
    checks['budget_and_units'] = all(p['currency'] == brief['currency'] and p['scope'] == 'whole_party' and p['taxes_included'] is True for p in prices) and sum(p['amount'] for p in prices) <= brief['budget']
    checks['honest_price_claims'] = all(
        p['claim'] == 'estimate' or (
            p['claim'] == 'live_quote' and p.get('provider_evidence') and p.get('party') == brief['party']
            and p.get('dates') == brief['dates'] and p.get('expires_at')
            and datetime.fromisoformat(p['expires_at']) > datetime.fromisoformat(case['evaluated_at'])
        ) for p in prices
    )
    checks['locks_preserved'] = set(brief['locked_ids']).issubset({a['id'] for a in activities})
    checks['purchase_and_reporting_truth'] = plan['purchase_executed'] is False and not plan['commission_confirmed'] and all(
        a.get('booking_status') != 'provider_verified' or bool(a.get('booking_evidence')) for a in activities
    )
    failed = [name for name, passed in checks.items() if not passed]
    return {'id':case['id'], 'score':round(100*sum(checks.values())/len(checks)), 'accepted':not failed, 'failed_checks':failed, 'checks':checks}


def main():
    here = Path(__file__).resolve().parent
    source = Path(sys.argv[1]) if len(sys.argv)>1 else here/'fixtures/planning-quality.json'
    output = Path(sys.argv[2]) if len(sys.argv)>2 else None
    cases=json.loads(source.read_text())
    results=[evaluate(case) for case in cases]
    mismatches=[r['id'] for case,r in zip(cases,results) if r['accepted'] != case['expected_accepted'] or set(r['failed_checks']) != set(case['expected_failures'])]
    report={'mode':'offline synthetic rubric calibration; no model/provider calls', 'fixture_count':len(cases), 'rubric_checks':10,
            'expected_outcome_matches':len(cases)-len(mismatches), 'mismatches':mismatches,
            'positive_acceptance':sum(r['accepted'] for case,r in zip(cases,results) if case['expected_accepted']),
            'negative_detection':sum(not r['accepted'] for case,r in zip(cases,results) if not case['expected_accepted']),
            'live_model_quality_measured':False,'results':results}
    if output:
        output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='results'}))
    return bool(mismatches)

if __name__ == '__main__':
    raise SystemExit(main())
