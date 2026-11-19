# Physical iPhone QA — November 14, 2026

## Scope and artifact

Tested the connected physical iPhone 15 Pro through Apple iPhone Mirroring.
CoreDevice reported iOS 27.2.1, pairing, Developer Mode, and developer services.
The installed app identifies as `ai.faroway.app.qa`, version 1.0.0 (1).
The retained device artifact and EAS build
`6cebb27a-ff99-4d49-b1ea-4126fc5a427a` identify the `qa` internal-distribution
build at revision `367ec799ac7728c5f647bfe63c662c7f1076162e`.
Matching version metadata alone is not a binary hash comparison against the
installed app. No additional build was submitted during this QA session.

## Observed passes

- CoreDevice launched Faroway QA on the physical phone.
- Onboarding Get Started reached Explore. The hero and inspiration icons rendered.
- Create your trip opened the form; generation remained disabled without dates.
- Searching Lisbon offered the custom-destination option, which selected Lisbon.
- Tapping November 10, a past date, did not select it or enable date confirmation.
- December 7–9 selected a three-day range and enabled Generate itinerary.
- Traveler count increased from two to three and decreased back to two.
- Culture and Foodie selected visibly and updated the counter to 2/5.
- All twelve vibe labels and bundled icons rendered in the physical form.
- Allergy entry accepted the synthetic value `peanuts`; step-free entrance toggled on.
- Closing and reopening the form retained Lisbon, December 7–9, and two travelers.
- Generate as a guest displayed the staging QA sign-in sheet rather than a trip.

## Limitations and pending acceptance

- The user subsequently reported staging sign-in. On reconnection, the phone
  displayed a Lisbon generation preview with December 9 / Day 3 and two generic
  dining ideas. The reviewer did not initiate that generation. Saved-trip
  persistence, backend revision, and share flows remain unverified.
- Mirroring uses the Mac keyboard. It does not establish on-screen iPhone
  keyboard avoidance, nor VoiceOver, text scaling, camera, or microphone behavior.
- One rapid multiword text injection rendered reordered text. Replacing the
  selection with `peanuts` succeeded. Reproduce with direct phone typing before
  attributing this to application input handling versus mirroring automation.
- Explore's lower destination cards remained placeholders during these views;
  investigate loading and network behavior before declaring image coverage passed.
- Vibe/allergy/access preferences were set but their retention after reopen was
  not inspected. Only the visible destination, dates, and traveler count were checked.
- No live AI request, purchase, production deployment, or merge was performed.
  This describes reviewer actions; the displayed preview appeared after the
  user completed sign-in on the phone.

Follow-up design findings and source fixes are tracked in
[the mobile quality register](mobile-design-findings-20261114.md). Mirroring
later disconnected; this transport interruption is not evidence of an app crash.

## Mirroring procedure

### Authenticated continuation

After reconnecting, verified the saved Lisbon trip in My Trips, reloaded its
detail, switched all three day tabs, and checked the past-trip empty filter.
The detail hero recovered on reopen. Detail initially flashed a misleading
empty-itinerary state before hydration; a source fix and regression test are
tracked in the design register. Profile showed one upcoming trip. Saved Culture
and Foodie to the synthetic QA account and reopened preferences to verify both
persisted. No new generation or sharing operation was submitted.

### Connection handling

First-time mirroring requires user-approved Mac access, phone-side unlock,
and local Mac authentication. Decline optional notification forwarding unless
requested. After setup, lock and leave the test phone idle; using ChatGPT on
that same phone prevents mirroring from connecting. Use another device for the
chat. If mirroring says "iPhone in Use", resolve that state before UI testing.
Allow transitions to settle before judging screenshots, and verify text after
injection. Record physical-device observations separately from simulator results.
