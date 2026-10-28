# AI planning

Planning uses Google Gemini through Vercel AI Gateway. The model and allowed Google/Vertex routes are defined in `planning-disclosure.ts`; the shared AI client follows that same configuration. Use `AI_GATEWAY_API_KEY` where explicit gateway authentication is required.

The active workflow is `workflows/plan-trip.ts`. Search agents have bounded calls and deterministic fallback planning; supplier-backed prices are never manufactured by AI. Changing the recipient or disclosure requires updating planning consent.
