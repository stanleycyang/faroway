## Summary

<!-- Describe what this PR changes and why. -->

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Documentation
- [ ] Tests / CI

## Verification

- [ ] `bun run check` (type-check, lint, format)
- [ ] `bun run test` (unit & integration suites)
- [ ] `bun run test:evals` (offline itinerary quality evals)
- [ ] `bun run test:e2e:isolated` (if web UI / API routes changed)
- [ ] `bun run test:db` (if Supabase migrations / RLS changed)

## Security & Licensing Checklist

- [ ] No secrets, API keys, `.env*` files, or personal filesystem paths committed
- [ ] Server-only secrets are not exposed via `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`
- [ ] Database changes preserve Row Level Security (RLS)
- [ ] I agree to the contributor licensing terms in [CONTRIBUTING.md](CONTRIBUTING.md#licensing--contributor-agreement)
