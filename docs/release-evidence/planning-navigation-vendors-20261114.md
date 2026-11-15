# Planning navigation and supplier ranking follow-up

## Confirmed observation

The connected Android showed the user's saved Tokyo itinerary scrolled into day
three. Back and Share were no longer visible; generic dining ideas remained.
The user's trip was not modified, regenerated or deleted.

## Source fixes

- Keep Trips and Share outside the itinerary scroll view. Dismiss to the saved-trip
  library, including direct entry without a previous route, rather than relying
  on an unguarded back action.
- Replace the large progress percentage and animated emoji tiles with current
  server-reported work and optional planning details. Keep the reader's scroll
  position when streamed content arrives. Remove the completion overlay and the
  rating request before the traveler has reviewed their itinerary.
- Score generated suggestions using the same deterministic relevance function as
  supplier products. Regression coverage ensures a model's self-assigned 100
  cannot displace a better-matched supplier result, including its photo and link.
- Send the full trip date range to Viator search. Remove an unsupported commission
  percentage from the client documentation; earnings depend on partner terms.

## Verification and limits

Mobile suite: 76 suites, 765 tests passed before adding the final loading-detail
regression; the final three affected screen suites passed all 39 tests.
Workspace type/lint/format: 11 tasks passed, with nine existing web lint warnings.
Web suite: 187 files passed initially; five tests in the remaining runtime suite
could not bind localhost under sandbox restrictions. That entire six-test suite
passed with local server access. Combined coverage: 188 files, 1,731 tests.
The Impeccable detector returned no findings; this is not visual acceptance.

The installed phones still have the earlier native build. These UI fixes need
replacement builds and physical interaction/visual checks before acceptance.
The Vercel connector confirms the production Viator key is sensitive and does not
return its value. Live verification is waiting for credentials to be available
in the intended QA runtime. No live supplier response, attributable booking or
commission is claimed by these source tests. No additional paid AI call was made.
