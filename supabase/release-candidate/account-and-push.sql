-- REVIEW CANDIDATE ONLY. Separate from the approved staging bootstrap.
-- Apply as one transaction only after fresh staging rehearsal and explicit approval.
BEGIN;
CREATE TABLE public.account_deletion_receipts (
  user_id UUID PRIMARY KEY,
  recovery_hash TEXT NOT NULL UNIQUE CHECK (recovery_hash ~ '^[a-f0-9]{64}$'),
  phase TEXT NOT NULL DEFAULT 'pending' CHECK (phase IN ('pending','revocation_ready','revoked','data_deleted','completed')),
  apple_token_ciphertext TEXT,
  apple_subject TEXT,
  lease_id UUID,
  lease_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletion_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_deletion_receipts TO service_role;

CREATE FUNCTION public.claim_account_deletion(p_user_id UUID, p_recovery_hash TEXT, p_lease_id UUID, p_apple_subject TEXT DEFAULT NULL)
RETURNS SETOF public.account_deletion_receipts LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Account deletion requires read committed isolation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('account-write:'||p_user_id::text,0));
  INSERT INTO public.account_deletion_receipts(user_id,recovery_hash,apple_subject)
    VALUES(p_user_id,p_recovery_hash,p_apple_subject) ON CONFLICT(user_id) DO NOTHING;
  -- Only a freshly authenticated owner can invoke this service-only function.
  -- Reauthentication can replace a lost local recovery token after the lease.
  RETURN QUERY UPDATE public.account_deletion_receipts SET
    recovery_hash=p_recovery_hash,apple_subject=coalesce(apple_subject,p_apple_subject),
    phase=CASE WHEN apple_subject IS NULL AND p_apple_subject IS NOT NULL AND phase<>'completed' THEN 'pending' ELSE phase END,lease_id=p_lease_id,lease_until=clock_timestamp()+interval '2 minutes',updated_at=now()
    WHERE user_id=p_user_id AND (lease_until IS NULL OR lease_until<clock_timestamp()) RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_account_deletion(UUID,TEXT,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_account_deletion(UUID,TEXT,UUID,TEXT) TO service_role;

-- Fence new core writes while deletion is pending; deletion itself remains retryable.
CREATE FUNCTION public.reject_deleting_account_write() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target UUID; prior UUID;
BEGIN
  target := (to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME='users' THEN 'id' ELSE 'user_id' END)::uuid;
  IF TG_OP='UPDATE' THEN
    prior := (to_jsonb(OLD)->>CASE WHEN TG_TABLE_NAME='users' THEN 'id' ELSE 'user_id' END)::uuid;
    -- Owned search data cannot be detached or transferred while a purge takes
    -- an ownership snapshot. Anonymous claims (NULL -> owner) remain supported.
    IF TG_TABLE_NAME='searches' AND prior IS NOT NULL AND prior IS DISTINCT FROM target THEN
      RAISE EXCEPTION 'Search ownership is immutable' USING ERRCODE='55000';
    END IF;
  END IF;
  IF target IS NULL THEN RETURN NEW; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Account writes require read committed isolation';
  END IF;
  -- The claim waits for every earlier core write to commit before exposing the
  -- receipt. Later writes wait for the claim, then see it in a fresh snapshot.
  PERFORM pg_advisory_xact_lock(hashtextextended('account-write:'||target::text,0));
  IF EXISTS(SELECT 1 FROM public.account_deletion_receipts WHERE user_id=target) THEN
    RAISE EXCEPTION 'Account deletion in progress' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.reject_deleting_account_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER deletion_fence BEFORE INSERT OR UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.reject_deleting_account_write();
CREATE TRIGGER deletion_fence BEFORE INSERT OR UPDATE ON public.searches FOR EACH ROW EXECUTE FUNCTION public.reject_deleting_account_write();
CREATE TRIGGER deletion_fence BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.reject_deleting_account_write();

ALTER TABLE public.users ADD COLUMN notification_consent_version TEXT;
UPDATE public.users SET notification_settings='{"trip_reminders":false,"deals":false,"itinerary_updates":false,"app_updates":false}'::jsonb;
ALTER TABLE public.push_tokens ADD COLUMN consent_version TEXT;
ALTER TABLE public.push_tokens ADD COLUMN operation_revision BIGINT NOT NULL DEFAULT 0 CHECK(operation_revision>=0);
-- Do not choose an owner for ambiguous legacy tokens. Drop ALL registrations for
-- duplicates and invalidate every legacy grant. Deliberate Settings opt-in renews it.
DELETE FROM public.push_tokens WHERE token IN (SELECT token FROM public.push_tokens GROUP BY token HAVING count(*)>1);
UPDATE public.push_tokens SET is_active=false,consent_version=NULL;
ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_one_owner UNIQUE(token);
REVOKE INSERT, UPDATE, DELETE ON public.push_tokens FROM anon,authenticated;

CREATE FUNCTION public.set_device_push_consent(p_user_id UUID,p_token TEXT,p_revision BIGINT,p_enabled BOOLEAN,p_platform TEXT DEFAULT 'unknown')
RETURNS BOOLEAN LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE old public.push_tokens%ROWTYPE;
BEGIN
  IF p_revision<=0 OR p_revision>9007199254740991 OR p_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$' THEN RAISE EXCEPTION 'Invalid registration'; END IF;
  IF p_enabled AND EXISTS(SELECT 1 FROM public.account_deletion_receipts WHERE user_id=p_user_id) THEN RETURN FALSE; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_token,0));
  SELECT * INTO old FROM public.push_tokens WHERE token=p_token FOR UPDATE;
  IF FOUND THEN
    IF old.user_id<>p_user_id AND (old.is_active OR NOT p_enabled) THEN RETURN FALSE; END IF;
    IF p_revision<=old.operation_revision THEN RETURN FALSE; END IF;
    UPDATE public.push_tokens SET user_id=p_user_id,is_active=p_enabled,consent_version=CASE WHEN p_enabled THEN 'notifications-v2' ELSE NULL END,
      operation_revision=p_revision,platform=p_platform,last_seen_at=now(),updated_at=now() WHERE token=p_token;
  ELSE
    INSERT INTO public.push_tokens(user_id,token,platform,is_active,consent_version,operation_revision,last_seen_at)
      VALUES(p_user_id,p_token,p_platform,p_enabled,CASE WHEN p_enabled THEN 'notifications-v2' ELSE NULL END,p_revision,now());
  END IF;
  RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION public.set_device_push_consent(UUID,TEXT,BIGINT,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_device_push_consent(UUID,TEXT,BIGINT,BOOLEAN,TEXT) TO service_role;

CREATE TABLE public.itinerary_push_dispatches (
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  search_id UUID NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome TEXT NOT NULL DEFAULT 'claimed' CHECK(outcome IN ('claimed','accepted','failed','skipped')),
  PRIMARY KEY(trip_id,search_id)
);
ALTER TABLE public.itinerary_push_dispatches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.itinerary_push_dispatches FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.itinerary_push_dispatches TO service_role;

CREATE FUNCTION public.claim_itinerary_push(p_trip_id UUID,p_search_id UUID)
RETURNS JSONB LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE trip public.trips%ROWTYPE; n INTEGER;
BEGIN
  SELECT * INTO trip FROM public.trips WHERE id=p_trip_id FOR UPDATE;
  IF NOT FOUND OR trip.search_id IS DISTINCT FROM p_search_id OR trip.status<>'planned' OR trip.itinerary_id IS NULL THEN RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM public.account_deletion_receipts WHERE user_id=trip.user_id) THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=trip.user_id AND notification_consent_version='notifications-v2' AND notification_settings->'itinerary_updates'='true'::jsonb) THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.push_tokens WHERE user_id=trip.user_id AND is_active AND consent_version='notifications-v2') THEN RETURN NULL; END IF;
  INSERT INTO public.itinerary_push_dispatches(trip_id,search_id) VALUES(p_trip_id,p_search_id) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n=0 THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('userId',trip.user_id,'itineraryId',trip.itinerary_id);
END $$;
REVOKE ALL ON FUNCTION public.claim_itinerary_push(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_itinerary_push(UUID,UUID) TO service_role;
COMMIT;
