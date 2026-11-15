# Physical planning-navigation verification

Both approved EAS builds completed for e89332b4e2e1e694f567eb6efb344f8f8496f946
and were installed over the existing QA apps without deleting app data.

| Platform | Build | Evidence |
| --- | --- | --- |
| Android | 38e80108-b7f6-492c-81a1-8d8260179acb, version 17 | APK signature verified; install succeeded; saved Tokyo/Lisbon sessions retained |
| iPhone | ad45ac78-6d3a-492b-bfaf-d2b1414c06eb | Exact-commit IPA downloaded; device accepted installation and launch; post-install UI verification awaits Mirroring access |

Android checks passed: open saved Tokyo, render its destination image, scroll
into the itinerary while Trips/Share remain visible, return to the trip library,
reopen Tokyo, open Share disclosure and cancel without creating a public link.
Ignored screenshots are under artifacts/mobile-qa/android-38e80108/.

A smaller layout finding remains: the content panel's 24-point overlap clipped
hero metadata. Source padding now reserves that overlap plus the original inset.
This follow-up is not included in either installed build and needs visual recheck.
The existing Tokyo fallback content was not regenerated or changed.

No vendor-backed generation was dispatched. At inspection, Viator and Google
Places credentials remained production-only; LiteAPI was preview-scoped to a
different branch. The approved backend deployment has not been consumed and is
waiting for intended QA runtime credentials. Cumulative tracked AI spend remains
$9.88243885 of the original $20; no budget was increased or reset.

CI 43671406982 passed for e89332b. These native observations do not prove the
new loading flow, direct-entry navigation, live suppliers, affiliate handoff,
commission reconciliation or full production readiness.
