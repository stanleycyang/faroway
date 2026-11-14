# Credentials for bounded staging acceptance

Use dedicated staging users and the staging Supabase project
`omovikloadpvzijoaqus`. Never inherit the web app's local environment for an
acceptance run: it may point at production. Decode the supplied legacy Supabase
JWT locally and check both its project reference and role before use. Do not
print credentials or authentication responses.

Before a paid run, reconcile the dedicated Gateway allowance. An expired key
does not reset the allowance. If a replacement is explicitly authorized, subtract
all historical spend and cap the replacement at the remaining amount, rounded
down to cents, with no automatic refresh. Keep the cumulative ledger across keys.
Stop after the first failed or fallback result and reconcile billing before
dispatching more work.

For Vercel CLI 65.9.0, the key command is `ai-gateway api-keys`, not `keys`.
The `create` command does not accept `--json`; redirect its credential output to
a private file created with mode 0600. Listing keys and budgets supports JSON.
Check the installed command's help before reusing flags from another version.

Deployments that need privileged credentials require authorization covering the
destination and exact credential classes, including the staging service-role
key. Prefer overrides scoped to one protected preview rather than changing
shared project environment variables. This CLI accepts `--env NAME` and
`--build-env NAME`, reading the value from the child process environment. A
wrapper should pass only names in its argument array. Never interpolate secret
values into shell commands, command arguments, debug output, or deployment logs.

Export committed source into an isolated directory for upload. Inspect its file
inventory first: this CLI spells the inventory-only deployment option `--dry`.
Exclude local environment files, account files, private receipts and ignored
artifacts. Verify the preview's exact source revision and staging target before
any authenticated write or model call; an alias may still point at an older
deployment. Keep Deployment Protection enabled and use authenticated access.
Set and verify the preview's public base URL as well: an omitted
`NEXT_PUBLIC_BASE_URL` can make sharing return a production link. Do not follow
such a link during staging acceptance. `--skip-domain` is a production-only CLI
option and cannot be used to submit a preview.

Restoring environment settings does not revoke credentials captured by an older
deployment. After collecting evidence, delete the temporary live preview and
verify removal. Preserve failed receipts privately. Provisioned, confirmed test
accounts prove password authentication only; they do not establish email delivery
or confirmation/recovery acceptance.

A polling transport error does not establish that the remote workflow stopped.
Retain the trip when terminal status is unknown, stop the batch, record its ID,
and inspect remote status and billing before cleanup or retry. Once terminal
state is confirmed, delete only the synthetic test trip and verify the deletion.
Do not grade a run as successful without its saved result, even if upstream
model calls completed. Preserve failed evidence when repairing the harness.
