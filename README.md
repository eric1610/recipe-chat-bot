# Recipe Chat Bot

A SvelteKit and Skeleton 5 recipe-chat foundation with Auth.js, Google and GitHub OAuth,
Neon Postgres history, canonical conversation links, user cooking preferences, and streamed
OpenRouter recipe responses.

## Stack

- SvelteKit 2, Svelte 5, TypeScript 7, Skeleton 5, and Tailwind CSS 4
- Auth.js `@auth/sveltekit` 1.11.3 with database sessions
- Drizzle ORM and Neon serverless Postgres
- AI SDK 7 with the OpenRouter provider and Svelte streaming client
- Server-rendered `/chat/[conversationId]` routes backed by account-scoped conversation data
- Vercel server runtime and GitHub Actions validation

Auth.js currently labels its SvelteKit integration experimental even though 1.11.3 is the
latest stable npm release. Review Auth.js release notes before future upgrades.

## Local validation

Install dependencies and run the checks without downloading production secrets or running a local
database:

```sh
pnpm install
pnpm run check
pnpm run test
pnpm run db:check
pnpm run build
pnpm audit --audit-level=low
```

Advisory-lock and destructive cleanup integration tests require an isolated, migrated Postgres
database whose name contains `test`. Set only `TEST_DATABASE_URL`, make sure it differs from
`DATABASE_URL`, and run `pnpm run test:db`. Never use a production or shared preview database.

The authenticated application is tested through the protected Vercel production environment.
Production credentials, including the OpenRouter API key, must not be copied into `.env`,
`.env.local`, a shell profile, GitHub, or a preview deployment. If isolated local authentication is
added later, use separate non-production OAuth and OpenRouter credentials, an independent database
branch, and newly generated secrets.

The project installs TypeScript 7.0.2 as requested. SvelteKit currently declares TypeScript 5/6
support, so `pnpm run check` temporarily runs the pinned checker with TypeScript 6.0.3 while the
application remains authored and built with the installed TypeScript 7 toolchain.

When the schema changes, generate and commit a migration:

```sh
pnpm run db:generate
```

## Deploy to Vercel

1. Import this GitHub repository into Vercel and keep the detected SvelteKit settings.
2. Create production Google and GitHub OAuth applications using:
   - `https://YOUR_DOMAIN/auth/callback/google`
   - `https://YOUR_DOMAIN/auth/callback/github`
3. Add `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`,
   `AUTH_GITHUB_SECRET`, `OPENROUTER_API_KEY`, `AI_DAILY_CAP_EXEMPT_EMAILS`, and `CRON_SECRET` as
   **Sensitive, Production-only** Vercel variables. Generate `CRON_SECRET` independently with
   `openssl rand -hex 32`. The exemption variable is a comma-separated server-side allowlist and
   bypasses only the personal AI cap.
4. Use a least-privileged Neon role for the runtime `DATABASE_URL`. Keep the schema-owner migration
   credential outside Vercel and use it only while running `pnpm run db:migrate`. Before enabling
   cleanup, verify the runtime role can update `ai_generation_attempts` and delete from
   `ai_generation_attempts` and `ai_quota_windows` without granting schema-owner privileges.
5. Run committed migrations before deploying application code that requires the new schema.
6. Deploy `main` through Vercel's Git integration. Preview and development deployments are blocked
   from receiving production credentials, and non-`main` Vercel builds are ignored.
7. GitHub Actions scans the full Git history for secrets, runs checks and tests, and audits the
   dependency graph. Vercel performs the only production build and deployment.
8. Vercel invokes `/api/cron/ai-quota-cleanup` daily during the 02:00 UTC hour. After the first
   deployment, verify the Cron Jobs dashboard shows a successful authenticated invocation.

Vercel Hobby is intended for personal, non-commercial projects. Choose a suitable paid or
commercial host before using the application commercially.

## Data behavior

- Signed-in conversations and preferences are scoped to the Auth.js session user ID in Neon.
- Saved cooking preferences are loaded by authenticated user ID for each AI request and sent to the
  selected OpenRouter provider as bounded, server-owned instructions. Allergy entries are strict;
  other cooking preferences are defaults that an explicit request may override. Users should avoid
  storing unrelated medical or highly sensitive information in preference notes.
- Message input and model output are normalized before storage. Assistant Markdown is converted to
  HTML only at display time, with raw HTML escaped, remote images disabled, and generated HTML
  restricted to an explicit tag, attribute, and URL-scheme allowlist.
- State-changing JSON and form requests require same-origin metadata and bounded bodies. Preference
  fields use strict names, types, counts, and lengths, while conversation identifiers are validated
  as UUIDs before account-scoped database operations.
- `/chat` starts a new conversation. After its first message is persisted, the application moves to
  `/chat/[conversationId]`; direct navigation and refresh restore the complete ordered message chain
  from Neon after an ownership check.
- Google and GitHub accounts with matching emails are not linked automatically.
- Account deletion cascades through OAuth accounts, sessions, preferences, conversations, and
  messages and identifiable AI-attempt records stored by this application. Anonymous aggregate
  quota-window counts remain operational metrics without conversation content.
- AI-attempt metadata contains user, conversation, and message identifiers, status, model, timing,
  token totals, and sanitized error codes—but no prompt or response text. It is deleted seven days
  after attempt creation. Cleanup retains the current and immediately previous UTC quota windows;
  older aggregate windows are deleted. Provider backup or point-in-time recovery retention may
  delay physical disappearance from backups.

## AI requests and limits

- Signed-in users can stream responses from OpenRouter's `openrouter/free` router. The API key,
  system instructions, quota decisions, and provider errors remain server-side.
- Requests include at most the ten most recent user/assistant messages and 12,000 characters of
  server-owned conversation context loaded after an account-ownership check.
- Requests may also include up to 4,000 characters of normalized account cooking preferences. These
  values are treated as untrusted data and are not copied into conversation messages or logs.
- Provider routing sets `data_collection: deny`, limiting selection to providers that declare they
  do not collect prompts for training. Free-model availability can therefore vary.
- Each upstream attempt is counted conservatively against the shared UTC-day window. Standard users
  receive 10 successfully persisted responses per day, configured exempt accounts have no personal
  cap, and every account still shares the application-wide cap of 50 upstream attempts.
- The interface shows exact personal usage and only qualitative shared states: available, running
  low, critical, or exhausted. A provider `429` immediately marks shared capacity exhausted until
  its `Retry-After` time or the next internal UTC window.
- Failed, cancelled, and provider-limited attempts remain counted against shared capacity because
  OpenRouter may have received them, but they do not consume the user's successful-response
  allowance. Completed assistant messages and token totals are saved only after streaming finishes
  successfully.
- OAuth access, refresh, and ID tokens are not retained. Database session tokens are stored as
  keyed hashes, and rotating `AUTH_SECRET` invalidates existing sessions.
