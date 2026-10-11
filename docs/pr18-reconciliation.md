# PR18 reconciliation audit

Read-only audit on 2026-10-04 of [PR18](https://github.com/stanleycyang/faroway/pull/18), head **`f5c6cfab26928debd5f379952b2de867f6e9d24a`**, against reviewed PR33 runtime **`68e1b247db430b8650bdeeb74a24364f6beba2c2`**. PR18 is not an ancestor of PR33. Its current [PR CI](https://github.com/stanleycyang/faroway/actions/runs/33145538734) failed Format check; tests/build were skipped. No branch was changed, merged or closed, and no behavior on PR18 was executed during this audit.

## Completed selective salvage

At the audited baseline, the [mobile generation screen](../apps/mobile/app/create/generating.tsx) set `hotels: streaming.topHotel ? 10 : 0`, while [stream handling](../apps/mobile/hooks/useStreamingItinerary.ts) discarded the reported count. PR18 contained the useful idea of preserving `hotelsCount`.

The selective fix is now in runtime **`78827b70aeb2ee17c22c9ffc8eae61b56d86b9a7`** (identical file tree to implementation commit `407ad25d96a95df703176f1b342f5403ffbd70f6`). It validates reported hotel/activity/dining/transport counts and bounded progress. Adjacent preview fallbacks also fabricated $200/night, four stars and a 4.5 rating; these are removed. Prices require a positive finite amount and supplied currency and are labeled estimates. Unknown values remain unavailable. Tests cover absent, malformed, zero and real counts plus rendered previews. Local 255 mobile tests, typecheck, lint and formatting pass; exact-head CI and focused review are tracked in [release-verification.md](release-verification.md). No unrelated PR18 modules or automatic-generation flow were transplanted.

## Useful improvements still absent

- PR18's `lib/auth/login-copy.ts` gives create/trips redirects contextual login/signup copy. Current [login](../apps/web/app/auth/login/page.tsx) always says “Welcome back.” Port copy only, retaining current redirect validation.
- PR18's `lib/tripRequirements.ts` explains missing destination/dates. Current [native create form](../apps/mobile/app/create/index.tsx) disables Generate without that explanation. Its [AuthGate](../apps/mobile/components/AuthGate.tsx) still says “Maybe Later” instead of “Keep editing.” These are useful polish, not authorization or payment changes.
- PR18 distinguishes incomplete/401 streams and displays “Still planning” with reconnect/auth actions. Current [generation screen](../apps/mobile/app/create/generating.tsx) has safe reconnect/review-and-start actions but still a generic “Something went wrong” heading. Any port must preserve current `canStart`, versioned consent, account binding and no-duplicate-dispatch handling.
- PR18 translates internal web phase names into traveler language; the current [web loader](../apps/web/components/trips/ItineraryGenerationLoader.tsx) renders raw `phase`.
- PR18 rejects placeholder App Store IDs and hides an unavailable rating destination. Current [store-review helper](../apps/mobile/lib/storeReview.ts) accepts Apple store hosts without rejecting `id0000000000`; the profile can fall back to Support under a Rate label. Consider a narrow destination/copy fix; actual configured store metadata was not inspected.

## Already covered or unsafe to transplant wholesale

Current web creation preserves a draft through login and uses account-scoped idempotent recovery plus fresh AI consent. PR18's separate session/query draft format and automatic generation after login should not replace it. Current native creation resumes after authentication; trip detail has explicit loading/error/retry states, and onboarding/Explore already disclose sign-in. The dead profile gear was removed, and automatic completion-rating prompts are absent. These do not need the stale implementations.

Landing/generation component extraction is optional structural work, not a launch dependency. Current landing copy can still be clearer about sign-in before generation. Keep PR18 open until each retained improvement is represented in reviewed work and an explicit disposition is recorded; do not mark all of it superseded merely because PR33 exists.
