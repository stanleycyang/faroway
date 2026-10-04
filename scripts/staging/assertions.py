"""Assertions on the complete migrated application schema. Local synthetic identities only."""
import json,uuid

def verify(sql,root,bootstrap_complete=False):
    owner='00000000-0000-4000-8000-000000000001'; other='00000000-0000-4000-8000-000000000002'
    trip='10000000-0000-4000-8000-000000000001'; othertrip='10000000-0000-4000-8000-000000000002'
    search='20000000-0000-4000-8000-000000000001'; othersearch='20000000-0000-4000-8000-000000000002'
    auth=f"SET ROLE authenticated; SET request.jwt.claim.sub='{owner}'; SET request.jwt.claim.role='authenticated'; "
    service="SET ROLE service_role; SET request.jwt.claim.role='service_role'; "
    # With auto exposure off, even service_role needs explicit relation grants.
    if not bootstrap_complete: sql(service+'SELECT * FROM trips;',ok=False)
    sql(f"INSERT INTO auth.users(id,email) VALUES('{owner}','owner@fixture.invalid'),('{other}','other@fixture.invalid');")
    assert sql('SELECT count(*) FROM public.users;')=='2'
    sql(f"INSERT INTO trips(id,user_id,destination,start_date,end_date) VALUES('{trip}','{owner}','Fixture Harbor','2099-06-01','2099-06-02'),('{othertrip}','{other}','Fixture Garden','2099-06-01','2099-06-02');")
    sql(f"INSERT INTO searches(id,user_id,destination,start_date,end_date) VALUES('{search}','{owner}','Fixture Harbor','2099-06-01','2099-06-02'),('{othersearch}','{other}','Fixture Garden','2099-06-01','2099-06-02');")
    if not bootstrap_complete:
        sql((root/'supabase/staging/synthetic-content.sql').read_text())
        # Legacy SECURITY DEFINER exposure exists despite no automatic table grants.
        assert sql('SET ROLE anon; SELECT sum(trip_count) FROM get_destination_trip_counts();')=='2'
        assert sql('SET ROLE anon; SELECT sum(search_count) FROM get_destination_search_counts();')=='2'
        sql("SET ROLE anon; SELECT increment_blog_view_count('fixture-published');")
        assert sql("SELECT view_count FROM blog_posts WHERE slug='fixture-published';")=='1'
        print('PASS reproduced legacy helper exposure even with automatic table grants off',flush=True)
    permissions=(root/'supabase/staging/permissions.sql').read_text();sql(permissions);sql(permissions)
    for prefix in ['SET ROLE anon; ',auth]:
        for query in ['SELECT * FROM get_destination_trip_counts();','SELECT * FROM get_destination_search_counts();',"SELECT increment_blog_view_count('fixture-published');",f"SELECT * FROM get_user_push_tokens('{other}');","SELECT deactivate_push_token('fixture-other');",'SELECT * FROM affiliate_stats;','SELECT * FROM analytics.product_funnel_daily;']:
            sql(prefix+query,ok=False)
        assert sql(prefix+'SELECT count(*) FROM destinations;')=='2'
        assert sql(prefix+'SELECT count(*) FROM blog_posts;')=='1'
        sql(prefix+"INSERT INTO blog_post_views(post_slug) VALUES('fixture-published');",ok=False)
        sql(prefix+"INSERT INTO newsletter_subscribers(email) VALUES('x@fixture.invalid');",ok=False)
    assert sql(service+'SELECT sum(trip_count) FROM get_destination_trip_counts();')=='2'
    assert sql(service+'SELECT sum(search_count) FROM get_destination_search_counts();')=='2'
    prior_views=int(sql("SELECT view_count FROM blog_posts WHERE slug='fixture-published';"))
    sql(service+"SELECT increment_blog_view_count('fixture-published');")
    assert int(sql(service+"SELECT view_count FROM blog_posts WHERE slug='fixture-published';"))==prior_views+1
    assert sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE');")=='0'
    assert sql("SELECT count(*) FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename AND c.relnamespace='public'::regnamespace WHERE t.schemaname='public' AND NOT c.relrowsecurity;")=='0'
    print('PASS public published reads, service helpers and complete SECURITY DEFINER denial for client roles',flush=True)
    assert sql(auth+'SELECT count(*) FROM trips;')=='1'
    assert sql(auth+'SELECT count(*) FROM searches;')=='1'
    assert sql(auth+'SELECT count(*) FROM users;')=='1'
    sql('SET ROLE anon; SELECT * FROM trips;',ok=False)
    sql(auth+"UPDATE users SET subscription_tier='premium';",ok=False)
    assert sql(auth+f"UPDATE users SET display_name='Synthetic owner' WHERE id='{owner}' RETURNING id;")==owner
    assert sql(auth+f"UPDATE users SET display_name='Other' WHERE id='{other}' RETURNING id;")==''
    sql(auth+f"UPDATE trips SET status='generating' WHERE id='{trip}';",ok=False)
    sql(auth+f"UPDATE searches SET workflow_run_id='forged' WHERE id='{search}';",ok=False)
    sql(service+f"INSERT INTO push_tokens(user_id,token,platform) VALUES('{other}','fixture-other','ios');")
    sql(auth+f"INSERT INTO push_tokens(user_id,token,platform) VALUES('{owner}','fixture-owner','android') ON CONFLICT(user_id,token) DO UPDATE SET is_active=TRUE;")
    assert sql(auth+'SELECT count(*) FROM push_tokens;')=='1'
    assert sql(auth+"DELETE FROM push_tokens WHERE token='fixture-other' RETURNING token;")==''
    assert sql(auth+"DELETE FROM push_tokens WHERE token='fixture-owner' RETURNING token;")=='fixture-owner'
    sql(auth+f"INSERT INTO push_tokens(user_id,token,platform) VALUES('{other}','spoof','ios');",ok=False)
    print('PASS owner RLS, profile privilege limits, lifecycle fences and native token registration/removal',flush=True)
    sql(service+f"UPDATE trips SET status='generating',search_id='{search}' WHERE id='{trip}';")
    payload={'days':[{'date':'2099-06-01','morning':{'activities':[{'name':'Synthetic walk'}]},'afternoon':{'activities':[{'name':'Synthetic museum'}]}}],'overview':'Synthetic saved plan','total_cost':{'currency':'USD','amount':50}}
    assert sql(service+f"SELECT apply_trip_generation_update('{trip}','{othersearch}','planned','{json.dumps(payload)}');")=='f'
    assert sql(service+f"SELECT apply_trip_generation_update('{trip}','{search}','planned','{json.dumps(payload)}');")=='t'
    assert sql(auth+'SELECT count(*) FROM itineraries;')=='1'
    assert sql(auth+'SELECT count(*) FROM notifications;')=='1'
    sql(auth+'UPDATE itineraries SET overview=\'Spoof\';',ok=False)
    sql(auth+"UPDATE notifications SET title='Spoof';",ok=False)
    sql(auth+'UPDATE notifications SET read=TRUE;')
    assert sql(service+'SELECT count(*) FROM notifications;')=='1'
    sql(service+f"INSERT INTO saved_activities(trip_id,activity_name) VALUES('{othertrip}','Foreign saved activity');")
    sql(auth+f"INSERT INTO saved_activities(trip_id,activity_name) VALUES('{trip}','Owned saved activity');")
    assert sql(auth+'SELECT count(*) FROM saved_activities;')=='1'
    version=sql(f"SELECT updated_at FROM trips WHERE id='{trip}';")
    handoff=f"SELECT prepare_trip_handoff('{trip}','{owner}','{version}','fixture-handoff','activity_v_123P1@2099-06-01','Synthetic experience','https://example.invalid/checkout');"
    assert sql(service+handoff)=='t'
    assert sql(auth+'SELECT count(*) FROM affiliate_clicks;')=='1'
    sql(auth+"UPDATE affiliate_clicks SET converted=TRUE;",ok=False)
    sql(auth+f"INSERT INTO trip_feedback(trip_id,user_id,score) VALUES('{trip}','{owner}',5);")
    sql(auth+f"UPDATE trip_feedback SET trip_id='{othertrip}';",ok=False)
    sql(auth+f"INSERT INTO trip_feedback(trip_id,user_id,score) VALUES('{othertrip}','{owner}',5);",ok=False)
    sql(service+'SELECT * FROM analytics.product_funnel_daily; SELECT * FROM analytics.activation_daily; SELECT * FROM analytics.retention_weekly;')
    print('PASS actual-schema generation, public/private reads, feedback ownership and affiliate handoff grants',flush=True)
    days=json.loads(sql(f"SELECT stamp_plan_items('{trip}',days) FROM itineraries WHERE trip_id='{trip}';"))
    item=days[0]['morning']['activities'][0]['planItemId']
    cmd={'requestId':str(uuid.uuid4()),'expectedUpdatedAt':version,'expectedPlanRevision':None,'action':'lock','itemId':item}
    edit=f"SELECT edit_trip_plan('{trip}','{owner}','{json.dumps(cmd)}','{json.dumps(days)}',ARRAY['{item}']);"
    assert json.loads(sql(service+edit))['state']=='applied'
    assert json.loads(sql(service+edit))['state']=='replayed'
    assert sql(service+handoff)=='f'
    sql(auth+'SELECT * FROM trip_plan_revisions;',ok=False)
    sql(service+'UPDATE trip_plan_revisions SET overview=\'Spoof\';',ok=False)
    version=sql(f"SELECT updated_at FROM trips WHERE id='{trip}';")
    report={'requestId':str(uuid.uuid4()),'expectedUpdatedAt':version,'generationId':sql(f"SELECT booking_generation_id FROM itineraries WHERE trip_id='{trip}';"),'itemId':item,'expectedReportId':None,'status':'traveler_booked'}
    write=f"SELECT report_trip_booking('{trip}','{owner}','{json.dumps(report)}');"
    assert json.loads(sql(service+write))['state']=='applied'
    assert json.loads(sql(service+write))['state']=='replayed'
    sql(auth+'SELECT * FROM trip_booking_reports;',ok=False)
    assert sql(service+'SELECT count(*) FROM affiliate_clicks WHERE converted;')=='0'
    assert sql(service+f"SELECT id FROM update_trip_brief('{trip}','{owner}','{version}','{{\"destination\":\"Fixture Garden\"}}');")==trip
    assert sql(service+handoff)=='f'
    assert json.loads(sql(service+write))['state']=='replayed'
    late={**report,'requestId':str(uuid.uuid4())}
    assert json.loads(sql(service+f"SELECT report_trip_booking('{trip}','{owner}','{json.dumps(late)}');"))['state']=='conflict'
    # Production timestamp trigger interaction: same transaction must not reuse a revision.
    sql(service+f"""BEGIN; DO $$ DECLARE v TIMESTAMPTZ; n INTEGER; BEGIN
      SELECT updated_at INTO v FROM trips WHERE id='{trip}';
      SELECT updated_at INTO v FROM update_trip_brief('{trip}','{owner}',v,'{{"destination":"Fixture A"}}');
      PERFORM * FROM update_trip_brief('{trip}','{owner}',v,'{{"destination":"Fixture B"}}');
      SELECT count(*) INTO n FROM update_trip_brief('{trip}','{owner}',v,'{{"destination":"Stale"}}');
      IF n<>0 THEN RAISE EXCEPTION 'Stale transaction revision accepted'; END IF;
    END $$; ROLLBACK;""")
    assert sql(service+"SELECT allowed FROM consume_rate_limit(repeat('a',64),10,60000);")=='t'
    assert sql(service+"SELECT claim_met_weather_cache('synthetic-cache');")=='t'
    assert '"trips": 0' in sql(service+'SELECT cleanup_stale_generation_state();')
    print('PASS immutable edits/reports, stale checkout, timestamp ordering, rate-limit/cache and safe cleanup RPCs',flush=True)
    sql(auth+f"DELETE FROM trips WHERE id='{trip}';")
    assert sql(service+'SELECT count(*) FROM trip_booking_reports;')=='0'
    assert sql(service+'SELECT count(*) FROM trip_plan_revisions;')=='0'
    print('PASS owner trip deletion preserves append-only guards while cascading owned history',flush=True)
