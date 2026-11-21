# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Faroway, please report it responsibly instead of opening a public GitHub issue.

- **Email:** `support@faroway.ai` (include `[Security]` in the subject line)
- **GitHub:** Use **Security -> Advisories -> Report a vulnerability** if enabled on the repository.

Please include:

- A clear description of the vulnerability and potential impact
- Steps to reproduce or a minimal proof of concept
- Affected files, endpoints, or packages

We aim to acknowledge reports within 48 hours and provide an update on remediation timelines promptly.

## Secret & Credential Hygiene

- Never commit `.env`, `.env.local`, `.p8`, `.pem`, `.p12`, `.jks`, `.key`, or service account JSON files.
- Secret scanning is configured via [`.gitleaks.toml`](.gitleaks.toml). Contributors with `gitleaks` installed can scan locally with:
  ```bash
  bun run test:secrets
  ```
- Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `AI_GATEWAY_API_KEY`, `IP_HASH_SALT`, `CRON_SECRET`, `WORKFLOW_WEBHOOK_SECRET`, and travel partner API keys) must never be prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.

## Security Architecture Highlights

- **Row Level Security (RLS)** is enforced on user-owned Supabase PostgreSQL tables and verified by disposable PostgreSQL test suites (`bun run test:db`).
- **Rate limiting** uses privacy-preserving HMAC-hashed identifiers (`IP_HASH_SALT`) backed by Supabase in production.
- **Content Security Policy & security headers** are configured in `apps/web/lib/security/headers.ts`.
- **Safe redirects & CORS** are validated via `apps/web/lib/security/validate-redirect.ts` and `apps/web/lib/security/cors.ts`.
