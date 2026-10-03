-- Apply after versioned briefs. No provider requests or purchases are made here.
ALTER TABLE public.affiliate_clicks ADD COLUMN IF NOT EXISTS trip_revision TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.prepare_trip_handoff(
  p_trip_id UUID, p_user_id UUID, p_revision TIMESTAMPTZ,
  p_click_id TEXT, p_item_id TEXT, p_item_name TEXT, p_url TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE t public.trips%ROWTYPE; c public.affiliate_clicks%ROWTYPE;
BEGIN
  -- Serialize publication with brief edits and generation completion. A provider
  -- lookup that began against an old revision cannot publish after an edit.
  SELECT * INTO t FROM public.trips WHERE id = p_trip_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR t.updated_at IS DISTINCT FROM p_revision
    OR t.status NOT IN ('planned', 'generated', 'booked', 'completed')
    OR COALESCE(t.preferences->>'planNeedsRefresh', 'false') = 'true' THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.affiliate_clicks(id,user_id,trip_id,item_id,item_type,item_name,
    affiliate_partner,affiliate_url,source,converted,clicked_at,trip_revision)
  VALUES(p_click_id,p_user_id,p_trip_id,p_item_id,'activity',p_item_name,
    'viator',p_url,'itinerary',FALSE,clock_timestamp(),p_revision)
  ON CONFLICT(id) DO NOTHING;
  SELECT * INTO c FROM public.affiliate_clicks WHERE id = p_click_id;
  RETURN c.user_id = p_user_id AND c.trip_id = p_trip_id AND c.item_id = p_item_id
    AND c.item_type = 'activity' AND c.affiliate_partner = 'viator'
    AND c.trip_revision = p_revision;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_trip_handoff(UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_trip_handoff(UUID,UUID,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) TO service_role;
