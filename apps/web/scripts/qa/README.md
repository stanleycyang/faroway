# Isolated private transaction checks

From the repository root:

```sh
node apps/web/scripts/qa/check-private-transactions.mjs artifacts/full-flow-ux-qa-2026-10-13/private-transactions-postgres.json
```

Requires Docker and the official `postgres:17.11` image. The runner creates a
uniquely named disposable database with networking disabled and no published
ports. It applies the repository’s actual revision-safe plan-edit and booking
report migrations to a minimal table substrate, then runs their functions as
`service_role`. It removes its own container and anonymous volume in `finally`.
No project credentials, production environment files, or hosted databases are
used. Output is synthetic test evidence only.

Checks include owner boundaries, lock/unlock/swap persistence, public-link
revocation after edits, exact replay and changed-request conflicts, receipt and
history reads, stale versions, forged derived plans, unfenced writes, and the
anonymous/authenticated privilege matrix. Two live PostgreSQL sessions verify
that the second edit waits on the first transaction’s row lock, then conflicts
after commit; only one non-baseline revision is persisted.

The bootstrap represents only columns required for these transaction checks.
This does not validate the full application migration chain, hosted Supabase
authentication/JWT verification, all production RLS policies, deployment, or
browser/native interaction. Those acceptance surfaces remain separate.
