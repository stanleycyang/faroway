# Production readiness checkpoint — October 20, 2026

Source baseline: `9384d24` plus the local share-status correction,
release-verification configuration and documentation changes. Verification ran
in a separate worktree without dotenv
files, using Bun 1.3.9, Node 22.14.0 and disposable Docker databases. No hosted
database writes, deployment, provider activation or paid AI requests were made.

## Automated evidence

- All 11 quality tasks passed, including a final rerun after the browser-artifact
  configuration changes.
- 1,875 unit/script tests passed: 1,080 web, 651 mobile, 136 shared and 8 scripts.
- The first unrestricted parallel run timed out in the CLI measurement test.
  With web workers capped at four and mobile at two, the complete rerun passed
  without increasing assertion deadlines. The rerun also standardized Node to 22.
- All 13 offline planning fixtures matched their expected rubric outcomes. This
  measures fixture calibration, not live model quality.
- All six disposable PostgreSQL suites passed: trip-attempt fencing, database
  privilege boundaries, full staging bootstrap, helper search paths, account/push
  release and durable trip-creation recovery. The bootstrap rehearsed all 43
  repository migrations against PostgreSQL 17.11.
- All 60 synthetic browser checks passed across desktop and mobile viewports:
  28 checkout/Places checks and 32 full-app recovery checks after the corrections
  below. The standalone normal production build also passed using the local
  catalog fixture.
- Both verification entrypoints refused a synthetic `.env.production` file in
  an isolated preflight check before starting any build or tests.
- `bun run release:check:mobile` passed in the original configured workspace:
  required variable checks, zero EAS configuration warnings/failures and 18/18
  Expo Doctor checks. Values were not recorded. The local optional mobile Sentry
  DSN is absent; verify its presence and delivery in the signed release separately.

## Corrections during verification

The original full-app run had six failures, corresponding to three cases on both
viewport sizes. The revoked-share case returned unavailable content with HTTP 200
because `/s/loading.tsx` streamed before the token layout checked access. Removing
that outer boundary keeps validation before headers; the inner token loading UI
remains. The strengthened regression requires published content before revocation
and HTTP 404 without itinerary content after revocation.
Next documents the status distinction for streamed and non-streamed responses in
its [not-found reference](https://nextjs.org/docs/app/api-reference/file-conventions/not-found).

The other two cases expected the plan editor to close after a save. Current code
explicitly preserves its open state across refreshes. Their expectations now
match that behavior; saved history, lost-response recovery and duplicate-write
assertions remain intact.

The standalone production build uses a separate read-only local catalog fixture.
It allows only GET/HEAD reads of blog posts and destinations and fails verification
on unexpected requests. It uses normal Next configuration, Turbopack and Google
font downloads. Its synthetic catalog and dummy keys make the output unsuitable
for deployment. This does not replace building the actual hosted release against
its approved environment and content.

Final evidence combines the complete unit/SQL/checkout run, the corrected recovery
run, the standalone build and the final quality rerun; the initial all-in-one run
failed on the browser cases described below. Local logs are
`/tmp/faroway-production-readiness-{verification,recovery,build,quality,mobile}.log`.
These temporary logs are not durable release evidence; retain CI artifacts for
the final release commit. The added release workflow has not run on GitHub and
repository branch protection has not been changed.

## Fresh hosted observations

Read-only Supabase connector inspection on October 21 at approximately 03:18 UTC
(October 20 Pacific) confirms both Faroway projects are `ACTIVE_HEALTHY`.

Production `jcnephijkxgtprsutgsf` still lacks the October release/security migrations
in its ledger. Unlike the older report, its ledger now includes the additional
`20261014050317_add_blog_posts_noindex` migration after the July entries. That
identity is absent from this checkout and must be reconciled before cutover.
Ledger absence does not prove the absence of unregistered manual schema changes;
inspect actual definitions and grants before applying the reviewed SQL.

The production security advisor reports the `affiliate_stats` owner-security view,
11 functions with mutable search paths, anonymous/authenticated execution of
privileged push helpers and other security-definer functions, and disabled leaked
password protection. Public execution is intentional for some functions; review
ownership and grants rather than treating every advisor warning as an exploit.
The existing reviewed security migrations address the push/global-view and
search-path changes; rehearse and apply them through the production cutover.

Staging `omovikloadpvzijoaqus` has bootstrap, account/push, creation recovery,
helper-search-path and hotel-party-preference migrations registered. Its advisor
reports disabled leaked-password protection plus eight expected no-policy RLS
notices for server-only tables. Do not add client grants to silence those notices.

## Remaining acceptance

Follow [production acceptance](../production-acceptance.md). Outstanding work is
hosted browser-to-API account isolation/deletion/conflict journeys, real AI output
quality using confirmed free allowance or a separately agreed spend cap, signed
physical-device acceptance, production recovery email and telemetry delivery,
backup/restore rehearsal, schema reconciliation and dependency-ordered cutover.
Existing production holds and provider gates remain unchanged.
