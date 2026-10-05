# Preview build fix verification

The build fix at `0041ce5217f77a2d1b3f81a413cb34b7c497b492` on `codex/release-candidate` produced a successful protected Vercel Preview on 2026-10-05. This note records build evidence, not approval for production cutover or feature activation.

## Cause and fix

The latest failed build of `c71aa003` stopped at `assertDatabaseIsolation` before application compilation. It preceded the staging settings correction. Separately, Turbo's strict build environment omitted `FAROWAY_STAGING_SUPABASE_PROJECT_REF`, so even a corrected Vercel value could not reach the guard. The fix explicitly forwards and hashes the staging ref, Vercel environment, planning pause and activation controls in `turbo.json`. The isolation guard and its rejection of production reuse are unchanged.

## Evidence

- Deployment `dpl_DeKRcyqcJYGxQUvUtq2oNJfpU2Sn` is READY at the exact fixed commit, with Preview target and only its branch alias. [Immutable Preview](https://faroway-74p248oq0-testimonio.vercel.app) and [deployment details](https://vercel.com/testimonio/faroway/DeKRcyqcJYGxQUvUtq2oNJfpU2Sn).
- Five new real-Turbo regression tests verify environment propagation, rejected unsafe targets and cache invalidation. They fail against the old config and pass with the fix. Eight script tests and 15 focused web tests passed locally; independent review found no blockers.
- The actual Vercel build completed with its normal command. The local default build passed the isolation guard but could not download Google Fonts; a separate local build passed with the repository's existing offline font fixture and webpack. The fixture was not committed into production configuration.
- Exact-runtime CI: quality checks, tests and web build all passed in [PR run 37248090587](https://github.com/stanleycyang/faroway/actions/runs/37248090587) and [push run 37248087571](https://github.com/stanleycyang/faroway/actions/runs/37248087571).

## Scope and remaining checks

Production remains READY at `5a8eadf06f596f81e8bcc0f4d90d3e58518c83eb`. Protection and branch-scoped staging settings are preserved; planning remains paused and activation flags off. No schema was executed. Account and push schema remains unapplied.

Anonymous HTTP checks from the execution environment were blocked by its proxy with CONNECT 403; no protection bypass was attempted. Protected browser checks are coordinated separately. An aggregate Preview log query found no error or fatal entries at 00:46 UTC, which is not proof of application coverage. Partner, purchase and production-cutover acceptance remain outstanding.
