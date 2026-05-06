# E2E Flow Contract

## FlowA_CreateGenerateView
- Entry: `/create`
- Outcome: generation progresses and allows trip view
- Required selectors: `create_screen`, `create_continue_button`, `generating_screen`

## FlowB_GuestAuthGateShare
- Entry: `/trip/:id` as guest
- Outcome: gated actions force auth prompt
- Required selectors: `trip_share_button`, `trip_save_button`, `auth_gate_modal`

## FlowC_TripsLibraryOpen
- Entry: `/(tabs)/trips`
- Outcome: open existing trip details
- Required selectors: `trip_screen`, `trip_day_tab_1`

## FlowD_InspirationPrefill
- Entry: `/inspiration/:slug`
- Outcome: surprise CTA pre-fills and navigates into create flow
- Required selectors: `inspiration_screen`, `inspiration_surprise_me_button`, `create_screen`
