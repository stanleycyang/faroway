# Tokyo provider-readiness finding

The user's Android Tokyo trip was inspected read-only in the dedicated staging QA
account. It was created on November 14, 2026 at 7:00 PM America/Los_Angeles for
November 19–27 and marked planned. Its entire saved activity inventory consisted
of three deterministic fallback ideas: self-guided neighborhood walk, local
market exploration and sunset viewpoint. None had an affiliate partner or photo.
These are not evidence of live vendor search, availability or commission tracking.
The user's trip was not changed or deleted. Private raw receipts are not committed.

## Configuration evidence

- Installed QA source 60ccd4b pins its API to the older
  `verify/staging-readiness-20261018` deployment. Its branch-specific preview
  configuration explicitly disables Viator content, external processing and
  hosted checkout, plus Google Places live access. This backend does not match
  the freshly tested e201be4 preview. Native UI acceptance is therefore separate
  from current-backend planning acceptance.
- Preview variable-name inspection lists no Viator key/partner ID or GetYourGuide
  key/partner ID. The only listed LiteAPI key is scoped to another preview branch.
- Production lists a Viator key and partner ID, plus a Google Places key. It lists
  neither GetYourGuide credentials nor the Viator content enablement/approval
  variables required by this branch. Existing stored keys alone are not a live
  integration pass, and this does not establish the revision deployed in production.
- A read-only connectivity probe was prepared to request one Tokyo product and
  report only HTTP status and counts. Vercel refuses to export production Secret
  values; the subprocess received no key and made no supplier request. This is an
  access limitation, not proof of an invalid Viator key or an API outage.

## Required release acceptance

For the intended vendor-backed Tokyo journey, verify all of the following on the
same backend revision used by the phones:

1. An approved vendor credential and its required display/processing configuration
   are available in the intended staging runtime; no secret is put in the app.
2. The provider returns actual Tokyo product IDs, images and supplier-provided
   booking URLs. Record status/counts and explicit disabled, auth-failed, empty,
   timeout and filtered outcomes; do not collapse these into an unexplained empty list.
3. Those products survive normalization, scheduling, persistence, reload and native
   rendering with attribution and images intact.
4. The booking handoff retains the expected affiliate attribution. No click or
   prepared URL proves a completed booking or earned commission.
5. When supplier-backed content is unavailable, the product clearly distinguishes
   incomplete planning ideas from a successfully researched itinerary. A green
   /api/health, source contract or AI-only smoke cannot satisfy this gate.

The e201be4 replacement preview passed synthetic tier-0 safety checks. Its paid
itinerary run was not dispatched after this higher-priority provider gap was
established; the temporary preview was removed. This turn made no AI Gateway call.
Full CI run 43669840973 passed all four jobs for e201be4.

Fresh iPhone sign-in loaded the two saved preferences and the Culture/Foodie
editor correctly. The saved Lisbon library card and detail hero rendered, and
pending detail fetch showed loading rather than a false empty state. These are
native UI observations against the older staging backend, not vendor acceptance.
