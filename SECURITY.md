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
- `OPENROUTER_API_KEY`, `CRON_SECRET`, and the AI-cap exemption allowlist are server-only,
  Sensitive, Production-only variables. None may be serialized into page data or browser bundles.
  Generate the cron secret independently with `openssl rand -hex 32`; never share it with preview
  or development deployments.
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
5. Verify CSP and security headers, canonical chat redirects, account ownership boundaries, cron
   authorization, and that private routes return `Cache-Control: private, no-store`.

## Data boundaries

- Authenticated conversation data is scoped to the session user ID and protected by database
  ownership filters, input validation, quotas, and rate limits.
- Chat routes require authentication. `/chat/[conversationId]` returns the same 404 response for a
  missing conversation and one owned by another account, and conversation history is never stored
  in browser storage.
- OAuth access, refresh, and ID tokens are discarded. Database session tokens are keyed hashes.
- Account deletion requires the exact confirmation phrase and removes application-owned account
  records through database cascades.
- AI generation accepts only one bounded user message and a conversation identifier; conversation
  history is loaded on the server after ownership checks. Provider routing denies providers that
  declare prompt collection, and raw provider errors are replaced with sanitized application
  messages.
- Application form mutations require a same-origin request, an approved form content type, and a
  bounded body before parsing. Preference fields reject unknown, duplicate, file, oversized, and
  invalid values; conversation mutations require canonical UUIDs before database access.
- Account cooking preferences are loaded using the authenticated user ID and included in provider
  prompts as bounded, normalized, untrusted data. They are not returned to the chat client, copied
  into message history, or recorded in AI-attempt metadata.
- Svelte escapes ordinary stored text. The only raw-HTML rendering boundary is assistant Markdown,
  where authored HTML is escaped and generated HTML is restricted to an explicit tag, attribute,
  and URL-scheme allowlist with remote images disabled.
- AI-attempt records contain identifiers, status, model, timestamps, and token totals but do not
  duplicate prompt or response content. User deletion removes identifiable attempt records while
  aggregate UTC quota-window totals remain for enforcement.
- Scheduled cleanup deletes AI-attempt metadata seven days after `created_at`, expires abandoned
  active attempts after two minutes, and retains only the current and immediately previous UTC
  quota windows. It also deletes expired application rate-limit rows, while preserving active
  windows. Conversation, message, preference, and user records are outside the cleanup deletion
  boundary. Neon backup and point-in-time recovery retention can delay physical removal from backup
  copies.
- The 50-attempt shared daily ceiling is reserved transactionally before provider access. A
  provider `429` latches shared exhaustion using `Retry-After`, preventing repeated calls against
  an exhausted key.

## DDoS and traffic-abuse response

- Vercel's platform firewall is the primary L3/L4/L7 DDoS boundary. The application database
  limiter is an authenticated abuse and spend control, not a substitute for edge mitigation.
- A published Vercel WAF rule observes `POST /api/chat` by source IP using a 20-request fixed
  60-second window. It remains in Log mode for 24 hours before returning `429`, unless an active
  attack requires immediate enforcement.
- During an incident, inspect Vercel Firewall traffic by path, IP, ASN, country, and JA4 fingerprint.
  Confirm whether function, Neon, and OpenRouter usage is increasing before changing application
  limits.
- For a sustained or distributed attack, enable Vercel Attack Challenge Mode with
  `pnpm dlx vercel firewall attack-mode enable --project recipe-chat-bot`. This challenges legitimate
  visitors too, so disable it with the corresponding `disable` command after traffic normalizes.
- Use targeted IP blocks only for repeat sources. Do not pause automatic system mitigations or add
  bypass rules during an incident.
- After recovery, verify sign-in and one streamed chat response, review usage, record the affected
  routes and mitigation timeline privately, and remove temporary IP blocks that are no longer
  needed.
