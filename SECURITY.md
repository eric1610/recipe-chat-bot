# Security Policy and Operations

## Reporting

Do not open a public issue for a suspected vulnerability or exposed credential. Contact the
repository owner privately with reproduction details and the affected route or component. Do not
include live secrets, full conversation content, or personal data in the report.

## Secret handling

- Production secrets are Sensitive, Production-only Vercel variables. Preview and development
  deployments must never share production credentials.
- The application uses a least-privileged Neon runtime role. Schema-owner credentials stay outside
  Vercel and are used only for reviewed migrations.
- Local environment files are ignored. Production values must not be copied into the repository,
  shell profiles, logs, screenshots, issue reports, or CI configuration.
- `OPENROUTER_API_KEY` and the AI-cap exemption allowlist are server-only, Sensitive,
  Production-only variables. Neither value may be serialized into page data or browser bundles.
- Rotate a credential immediately if it may have appeared in a preview, log, terminal transcript,
  or commit. Removing it from the current files does not revoke it or erase Git history.

## Deployment checklist

1. Review the generated SQL migration and take a Neon restore point or confirm point-in-time restore
   coverage.
2. Run `pnpm run check`, `pnpm run test`, `pnpm run db:check`, `pnpm run build`, and
   `pnpm audit --audit-level=low`.
3. Apply the migration with the protected schema-owner connection, then remove that credential from
   the process environment.
4. Push the reviewed commit to `main` and wait for GitHub validation and the Vercel production
   deployment.
5. Verify CSP and security headers, sign-in redirects, account ownership boundaries, guest-history
   clearing, and that private routes return `Cache-Control: private, no-store`.

## Data boundaries

- Authenticated conversation data is scoped to the session user ID and protected by database
  ownership filters, input validation, quotas, and rate limits.
- Anonymous history is held in the current tab's `sessionStorage`, expires after 12 hours of
  inactivity, and is never sent to the server until the user explicitly imports it after sign-in.
- OAuth access, refresh, and ID tokens are discarded. Database session tokens are keyed hashes.
- Account deletion requires the exact confirmation phrase and removes application-owned account
  records through database cascades.
- AI generation accepts only one bounded user message and a conversation identifier; conversation
  history is loaded on the server after ownership checks. Provider routing denies providers that
  declare prompt collection, and raw provider errors are replaced with sanitized application
  messages.
- AI-attempt records contain identifiers, status, model, timestamps, and token totals but do not
  duplicate prompt or response content. User deletion removes identifiable attempt records while
  aggregate UTC quota-window totals remain for enforcement.
- The 50-attempt shared daily ceiling is reserved transactionally before provider access. A
  provider `429` latches shared exhaustion using `Retry-After`, preventing repeated calls against
  an exhausted key.
