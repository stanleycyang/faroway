-- Drop the claim_anonymous_trips RPC. The anonymous trip flow has been
-- removed end-to-end (auth-gate-generation PR) and the /api/auth/claim-trips
-- route was deleted, so nothing calls this function anymore. We keep
-- cleanup_expired_anonymous_trips for now — pre-existing anonymous trips in
-- production still need to be expired.
DROP FUNCTION IF EXISTS public.claim_anonymous_trips(UUID, UUID[]);
