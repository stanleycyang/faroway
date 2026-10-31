# Faroway agentic optimization — Mac Mini handoff

Prepared 2026-10-31 UTC. Treat repository and external state as authoritative; revalidate before paid or deployment actions.

## Goal to create on the receiving machine

Optimize Faroway’s agentic trip-planning flow for cost, quality, reliability, and user experience. Discover and strengthen representative offline and end-to-end evals, establish baselines, iteratively implement and measure improvements against them, and ship validated improvements without regressing consent, safety, or production defaults. Keep cumulative live AI testing within the user's previously authorized $20 budget, accounting for prior spend.

Do not shrink completion to green tests, one successful trip, or narration alone. The original request is an exceptional agentic experience, demonstrated with representative evals and actual app behavior. Retain failed trials and uncertainty. No token budget was specified.

## Repository and current state

- Repository: https://github.com/stanleycyang/faroway
- Branch: `eval/agentic-quality-20261031`
- Latest implementation commit: `9d3c7e610f5558b2de374d0c9cef884164fde079`; subsequent handoff documentation commits are expected.
- Draft PR: https://github.com/stanleycyang/faroway/pull/55 — NOT production-ready. Prior user authorized review, push and merge when production-ready, not unconditional release.
- Duration-minutes fix was extracted and merged in PR #56; its production deployment remains pending.
- `docs/ai-evaluation-strategy.md` is the detailed measurement and rejected-experiment record. Read its initial goals and latest sections first; consult earlier evidence as needed.
- Last validation: 1,258 web tests and workspace type/lint/format checks passed for current implementation. Nine pre-existing lint warnings. The preceding eval-only change passed 93 script tests. Recheck current CI.
- Existing AI stack: AI SDK 6 / Gemini 3 Flash / Vercel AI Gateway. Do not upgrade SDK/model merely to resume.
- No other agent was delegated work. Preserve unrelated user changes and worktrees.

## What was built and measured

The branch has planning-step model/usage instrumentation, realistic frozen traces and contract evaluators, an offline schedule compiler, dated exclusion/address-evidence experiments, and a staging-only compiler/narrator integration at the shared aggregator boundary. Production defaults remain unchanged.

The compiler preserves supplied inventory IDs and durations, applies pace budgets and reviewed date exclusions, preserves day coverage, screens explicitly adult-focused visits for children, and discloses remote meals and omitted highlights. Its small reviewed source fixture is NOT general grounding. Generated inventory, coordinates, dietary/accessibility claims and booking availability remain unverified.

Narration receives only selected stops and may change title/summary. It has a 2,000-token cap, 30-second timeout, one call, zero retries, exact date/reference checks and disclosed fallback. Current references are request-local date/slot/position labels (`d1s2v1`); stored visit IDs never change. A conservative lexical guard rejects unverified suitability labels in narration. It is not a semantic fact checker.

The first deployed durable-workflow Lisbon test saved three days in 51.635 seconds but narration failed reference validation. The old smoke eval incorrectly passed its fallback output. That false positive is fixed with a sanitized committed regression fixture. The original private evidence remains intact and regrades as failed.

Latest frozen trials:

- Two original-reference low-thinking replays passed; original deployed failure remains intermittent/unexplained.
- Compact references + low thinking: 11/12 passed; Singapore parse failure. Separate diagnostic replay passed. Do not omit the failure.
- Compact references + minimal thinking: 12/12 structural passes, but manual review found copied unverified accessibility language. Rejected as an experience-quality result.
- Revised cautious prompt + minimal thinking: 12/12 passed; median narration 2.311 s, max 2.890 s, approximately $0.016679 for that batch, zero reported reasoning tokens. This excludes upstream generation, is one sample per development case, and does not establish production reliability. Some prose embellishment remains.
- All 12 authored development cases have upstream live traces. Six reserved holdouts remain unused. The proposed broader 40-development/20-holdout coverage and independent traveler review are not fulfilled.

## Exact next action

Repeat one consented test of the current candidate through the deployed staging API/durable workflow, inspect actual saved content and fallback/usage logs, then inspect browser/native rendering. The planned second deployed test was canceled for handoff BEFORE dispatching any trip or paid request. Do not claim it passed.

After that, continue improving selection, geography/nearby meals, explicit rest windows, long excursions, source discovery/venue identity, dietary and accessibility evidence, and narrative quality. Expand representative evals, run reserved holdouts only after freezing the candidate, and validate full app flows. Merge/release only when broad evidence supports readiness.

## Budget and credentials

- Dedicated Gateway budget: `faroway-android-uat-20261028`, nonrenewing $20 cap. Last reconciled total spent **$1.58**, leaving **$18.42** at that observation. This includes earlier UAT and this goal. Reconcile again before live work; do not reset the allowance by creating another $20 key.
- Key had a seven-day expiry when created; check current validity. On the original Mac it is in `~/.local/share/faroway-uat/gateway-create.private.log`. Its value is NOT in Git or the evidence archive. Transfer/provision it privately only if needed. Never print or commit it.
- Staging QA accounts exist on the original Mac in `~/.local/share/faroway-uat/accounts.json`; NOT included in the archive. Mini needs its own authenticated Vercel/Supabase/GitHub access or safely supplied dedicated credentials. Do not copy entire credential directories blindly.
- Continue offline work if credentials are unavailable. Ask for only the specific missing access before live work.
- Run paid CLI experiments with sanitized environment and `bunx bun@1.4.4 --no-env-file`; dedicated key goes in `FAROWAY_STAGING_AI_GATEWAY_KEY`, project ref in `FAROWAY_STAGING_SUPABASE_PROJECT_REF`. No production/vendor keys or ambient `.env.local` inheritance.
- A failed/unknown-billing run exits 3. Stop the batch and reconcile Gateway before more calls. Preserve the failed receipt; never overwrite it or quietly retry until green.
- Budget check: `bunx vercel ai-gateway budgets list --scope testimonio` (Node 22 used on original Mac).

## Deployment safety and handoff cleanup

- Vercel project `prj_fC34YwwfPMXckMb4vVpfkawHM17P`, team `testimonio`.
- Preview: `https://faroway-git-eval-agentic-quality-20261031-testimonio.vercel.app`.
- Staging Supabase ref: `omovikloadpvzijoaqus`; production ref: `jcnephijkxgtprsutgsf`. Existing staging guards reject production.
- Branch configuration was restored to `FAROWAY_PLANNING_PAUSED=true` and `AI_GATEWAY_API_KEY=disabled-review-preview`. Other branch flags retain the experiment and minimal aggregator thinking; upstream thinking is low. Deployment protection remains on.
- Both temporary live deployments were deleted: `dpl_Bgzo5W1U5ouFxucaMUrha5P7FK6r` (first test completed/cleaned) and `dpl_HPr26s5gmMs3xKWMpDc2VryAEFDu` (second test canceled before dispatch). APIs confirmed DELETED.
- Alias restored to paused deployment `dpl_9uRDNdkzSq6XkkAQaKzYJU6niDvp`; a subsequent paused documentation push may supersede it. Revalidate current alias/commit/environment before testing.
- New env settings require a new deployment. For a bounded test, use branch-only credentials, restore paused/disabled settings once that deployment captures them, and delete the temporary live deployment after collecting evidence. Restoring project env alone does NOT revoke secrets embedded in older deployments.
- Never disable preview protection. Use an authenticated share-link cookie or supported Vercel access; keep tokens private and same-origin only.
- Production main auto-deployment is intentionally disabled in `apps/web/vercel.json`. Do not remove that hold or promote all of main for a narrow fix. Production has substantial unrelated differences; release evidence lives under `docs/release-evidence/`.

## Private evidence transfer

A separate 2.7 MB archive was prepared on the original Mac:

`~/.local/share/faroway-handoff/agentic-evidence-20261031.tar.gz`

SHA-256: `a3156ea95a3da9fc52ad1785c04e3f33dc062398494015226c217d62f89f23ef`

It contains 172 trace/API-evidence files, not credentials. Known credential-pattern scan found no matches. Keep it private: it includes detailed generated trip/model data. Copy it separately to the Mini, verify the hash, and extract into the repository root. Avoid overwriting any existing local evidence; inspect before extraction. Git does not carry these ignored artifacts.

Important evidence directories under `artifacts/uat/`:

- `traces/compiled-long-visit-explanations-20261031/`: all 12 frozen compiler inputs.
- `traces/narration-minimal-cautious-20261031/`: latest 12 narration candidates.
- `traces/narration-compact-20261031/`: includes failed Singapore trial.
- `traces/narration-minimal-20261031/`: structurally passing but rejected suitability-language trial.
- `deployed-compiled-20261031/`: first real API receipt, runtime usage/fallback log, original misleading report, and corrected `regraded.json`.
- Other trace directories preserve baselines, rejected approaches, grounding/address/dining experiments. See strategy document for interpretation; directory existence is not success.

## Commands and entry points

Install locked dependencies with Bun; use Node 22 for Vercel CLI where required. Typical checks: `bun run check`, `bun run test:web`, `bunx bun@1.4.4 --no-env-file test scripts/__tests__`.

- Frozen trace grader: `scripts/uat/evaluate-traces.ts`.
- Live narration replay: `apps/web/scripts/narration-live.ts --live --thinking minimal --input <frozen-compiler-trace> --out <NEW-private-receipt>`.
- Integrated aggregator replay: `apps/web/scripts/aggregator-replay-live.ts --compiled-narrated`; inspect its arguments and staging gates before use.
- Real API UAT: `scripts/uat/smoke.ts --tier 2 --live --brief lisbon-city-break --supabase-url https://omovikloadpvzijoaqus.supabase.co --api-url <approved-preview>`; needs QA credentials and preview access. Capture persisted output before the harness deletes its test trip.
- `scripts/uat/lib/plan-quality.ts` now rejects narration fallback, including partial failure. A pass still does not prove factual/semantic quality.

Create/resume the goal in the Mini's own thread using the objective above. Do not assume this machine's thread-scoped goal or ignored evidence automatically transfers. Coordinate with the user to pause the original thread before concurrent work modifies the same branch or spends the same budget.
