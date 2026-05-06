# Itinerary Streaming

Faroway uses Server-Sent Events for progressive itinerary generation.

## Format

The progressive endpoint is:

```text
POST /api/trips/:id/stream
Accept: text/event-stream
```

Events are UTF-8 SSE frames:

```text
event: spec-block
data: {"blocks":[{"type":"TripSummary","props":{"destination":"Tokyo"}}]}

event: progress
data: {"step":"hotels","status":"searching","progress":21,"message":"Searching for the best hotels..."}
```

Current event types:

- `progress`: stage, progress percentage, message, and raw search progress.
- `micro`: granular provider messages when available.
- `hotels`, `activities`, `dining`, `transport`: provider result counts and preview metadata.
- `itinerary`: progressively renderable itinerary days.
- `spec-block`: json-render blocks that can be appended immediately.
- `spec-complete`: final json-render block array for caching.
- `complete`: terminal success.
- `error`: terminal failure.

SSE was chosen because the client only needs server-to-client updates, it works on existing hosting without new infrastructure, it is inspectable with plain HTTP tooling, and React Native can consume it with `XMLHttpRequest.onprogress`.

## Rollout

Streaming is reversible with client flags:

```text
NEXT_PUBLIC_ITINERARY_STREAMING_ENABLED=false
EXPO_PUBLIC_ITINERARY_STREAMING_ENABLED=false
```

When disabled, web and mobile fall back to generation status polling. The streaming endpoint can remain deployed while the clients are rolled back.

Before enabling the flags, apply the itinerary streaming migrations:

- `supabase/migrations/20260217100000_json_render_spec.sql`
- `supabase/migrations/20260223000000_add_intermediate_results.sql`

Then run the read-only schema preflight:

```bash
bun --filter @faroway/web schema:itinerary-streaming
```

Do not run rollout benchmarks or enable the streaming flags unless this command passes. It checks `searches.json_render_spec`, `searches.intermediate_results`, and the `merge_intermediate_results` RPC using a random zero-row probe.

The endpoint tolerates a database that is missing `intermediate_results` by streaming the trip summary, progress, final spec, and completion event, but per-day intermediate chunks require that column and the `merge_intermediate_results` RPC.

## Disconnects

The stream route observes `request.signal.aborted` and stops DB polling immediately when the client disconnects. Trip generation itself runs in the durable workflow started by `POST /api/trips/:id/generate`, so reconnecting to the stream resumes from persisted intermediate results instead of restarting work.

## Measurement

Run the latency script against a local or deployed web app:

```bash
bun --filter @faroway/web schema:itinerary-streaming

bun --filter @faroway/web perf:itinerary -- \
  --base-url http://localhost:3000 \
  --mode both \
  --samples 20 \
  --profile broadband \
  --timeout-ms 120000 \
  --json-output artifacts/itinerary-latency-broadband.json
```

When measuring a PR or preview deployment, compare the blocking baseline from
`main` against the streaming candidate explicitly:

```bash
bun --filter @faroway/web perf:itinerary -- \
  --baseline-base-url https://faroway-main.example.com \
  --stream-base-url https://faroway-pr-123.example.com \
  --mode both \
  --samples 20 \
  --profile broadband \
  --timeout-ms 120000 \
  --json-output artifacts/itinerary-latency-broadband.json
```

For simulated 4G, run the same command with the built-in client-side RTT and
downstream throttle, or through an equivalent OS/proxy network throttle:

```bash
bun --filter @faroway/web perf:itinerary -- \
  --base-url http://localhost:3000 \
  --mode both \
  --samples 20 \
  --profile simulated-4g \
  --simulated-rtt-ms 150 \
  --simulated-down-kbps 1600 \
  --timeout-ms 120000 \
  --json-output artifacts/itinerary-latency-4g.json
```

The script reports p50/p95 timings, error rate, timeout rate, and the p50
completion delta between baseline and streaming. The `--profile` value is
metadata only. The built-in throttle adds half the configured RTT before each
request, half before each response, and downstream delay while response bytes
are delivered to the measuring client. Record the actual throttle settings in
the PR; if an external throttle is used, include downstream, upstream, RTT, and
packet loss.

Report these values in the PR:

| Metric                                            | Baseline p50 | Baseline p95 | Streaming p50 | Streaming p95 |
| ------------------------------------------------- | -----------: | -----------: | ------------: | ------------: |
| TTFB / first byte                                 |          TBD |          TBD |           TBD |           TBD |
| Submit-to-first renderable section (`spec-block`) |          N/A |          N/A |           TBD |           TBD |
| Submit-to-first itinerary section                 |          N/A |          N/A |           TBD |           TBD |
| Submit-to-complete                                |          TBD |          TBD |           TBD |           TBD |

| Reliability metric   | Baseline | Streaming |
| -------------------- | -------: | --------: |
| Error rate           |      TBD |       TBD |
| Timeout rate         |      TBD |       TBD |
| Completion p50 delta |      N/A |       TBD |

The baseline mode uses `POST /api/itinerary`. The streaming mode creates a trip, starts `POST /api/trips/:id/generate`, then measures `POST /api/trips/:id/stream`.

## PR Rollout Plan

1. Deploy the backend streaming route and clients with both streaming flags set to `true` only in preview.
2. Run broadband and simulated-4G measurements against the preview deployment and paste the tables above into the PR.
3. Enable streaming for production web first. Monitor itinerary generation error rate, timeout rate, and stream disconnect logs for one release window.
4. Enable streaming for the Expo release channel after web metrics stay within the error-rate threshold.
5. Roll back by setting `NEXT_PUBLIC_ITINERARY_STREAMING_ENABLED=false` and `EXPO_PUBLIC_ITINERARY_STREAMING_ENABLED=false`; clients will use polling while the streaming endpoint remains deployed.
