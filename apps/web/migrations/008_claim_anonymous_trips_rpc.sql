-- Local mirror of the Supabase anonymous-trip claim RPC.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'search_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trips'
      AND column_name = 'expires_at'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'searches'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.claim_anonymous_trips(
        p_user_id UUID,
        p_trip_ids UUID[]
      )
      RETURNS TABLE(id UUID, search_id UUID)
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        RETURN QUERY
        WITH claimed AS (
          UPDATE public.trips
          SET
            user_id = p_user_id,
            expires_at = NULL,
            updated_at = NOW()
          WHERE public.trips.user_id IS NULL
            AND public.trips.id = ANY(p_trip_ids)
          RETURNING public.trips.id, public.trips.search_id
        ),
        linked_searches AS (
          UPDATE public.searches
          SET
            user_id = p_user_id,
            updated_at = NOW()
          WHERE public.searches.user_id IS NULL
            AND public.searches.id IN (
              SELECT claimed.search_id
              FROM claimed
              WHERE claimed.search_id IS NOT NULL
          )
          RETURNING public.searches.id
        )
        SELECT claimed.id, claimed.search_id
        FROM claimed;

        IF to_regclass('public.affiliate_clicks') IS NOT NULL THEN
          UPDATE public.affiliate_clicks
          SET user_id = p_user_id
          WHERE public.affiliate_clicks.user_id IS NULL
            AND public.affiliate_clicks.trip_id = ANY(p_trip_ids)
            AND EXISTS (
              SELECT 1
              FROM public.trips
              WHERE public.trips.id = public.affiliate_clicks.trip_id
                AND public.trips.user_id = p_user_id
            );
        END IF;

        IF to_regclass('public.affiliate_conversions') IS NOT NULL
           AND to_regclass('public.affiliate_clicks') IS NOT NULL THEN
          UPDATE public.affiliate_conversions
          SET user_id = p_user_id
          FROM public.affiliate_clicks
          WHERE public.affiliate_conversions.user_id IS NULL
            AND public.affiliate_conversions.click_id = public.affiliate_clicks.id
            AND public.affiliate_clicks.trip_id = ANY(p_trip_ids)
            AND public.affiliate_clicks.user_id = p_user_id;
        END IF;
      END;
      $body$;
    $fn$;

    EXECUTE 'REVOKE ALL ON FUNCTION public.claim_anonymous_trips(UUID, UUID[]) FROM PUBLIC';

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_anonymous_trips(UUID, UUID[]) TO service_role';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'affiliate_clicks'
    ) THEN
      EXECUTE $backfill_clicks$
        UPDATE public.affiliate_clicks
        SET user_id = public.trips.user_id
        FROM public.trips
        WHERE public.affiliate_clicks.user_id IS NULL
          AND public.affiliate_clicks.trip_id = public.trips.id
          AND public.trips.user_id IS NOT NULL
      $backfill_clicks$;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'affiliate_conversions'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'affiliate_clicks'
    ) THEN
      EXECUTE $backfill_conversions$
        UPDATE public.affiliate_conversions
        SET user_id = public.affiliate_clicks.user_id
        FROM public.affiliate_clicks
        WHERE public.affiliate_conversions.user_id IS NULL
          AND public.affiliate_conversions.click_id = public.affiliate_clicks.id
          AND public.affiliate_clicks.user_id IS NOT NULL
      $backfill_conversions$;
    END IF;
  END IF;
END $$;
