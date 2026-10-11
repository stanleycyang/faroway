# Hosted cross-account page isolation

On the release-candidate staging preview (source 0fda80b346067568497125ccfd321b2aa5f424ab), the owner signed into the second test account. Its dashboard displayed zero trips and the empty-state message.

Direct navigation to the first test account's saved Paris trip (`7c4394e5-67ec-44d6-9581-85d179c3c2fe`) and Tokyo trip (`93f80c7d-ca99-48f7-9773-90a32f797222`) displayed the app's 404/not-found page without trip details. Both trips had previously rendered successfully for their owner. Dashboard and direct page isolation passed for these two synthetic records.

The browser blocked top-level navigation to the Paris `/api/trips/[id]` endpoint with `ERR_BLOCKED_BY_CLIENT`; its authenticated API response was not observed. API isolation and cross-account mutation acceptance remain pending. No session credentials were extracted, no records were modified, and no planning was dispatched. The signed-in second-user dashboard was restored for continued testing.
