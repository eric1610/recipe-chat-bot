# Recipe Chat Bot

A SvelteKit and Skeleton 5 recipe-chat foundation with Auth.js, Google and GitHub OAuth,
Neon Postgres history, user cooking preferences, and session-only guest storage.
AI message generation is intentionally not connected yet.

## Stack

- SvelteKit 2, Svelte 5, TypeScript 7, Skeleton 5, and Tailwind CSS 4
- Auth.js `@auth/sveltekit` 1.11.3 with database sessions
- Drizzle ORM and Neon serverless Postgres
- Browser `sessionStorage` with a 12-hour inactivity limit for guest conversation data
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

The authenticated application is tested through the protected Vercel production environment.
Production credentials must not be copied into `.env`, `.env.local`, a shell profile, GitHub, or a
preview deployment. If isolated local authentication is added later, use separate non-production
OAuth clients, an independent database branch, and newly generated credentials.

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
3. Add `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`, and
   `AUTH_GITHUB_SECRET` as **Sensitive, Production-only** Vercel variables.
4. Use a least-privileged Neon role for the runtime `DATABASE_URL`. Keep the schema-owner migration
   credential outside Vercel and use it only while running `pnpm run db:migrate`.
5. Run committed migrations before deploying application code that requires the new schema.
6. Deploy `main` through Vercel's Git integration. Preview and development deployments are blocked
   from receiving production credentials, and non-`main` Vercel builds are ignored.
7. GitHub Actions scans the full Git history for secrets, runs checks and tests, and audits the
   dependency graph. Vercel performs the only production build and deployment.

Vercel Hobby is intended for personal, non-commercial projects. Choose a suitable paid or
commercial host before using the application commercially.

## Data behavior

- Signed-in conversations and preferences are scoped to the Auth.js session user ID in Neon.
- Guest history stays in `sessionStorage`, expires after 12 hours of inactivity, and can be cleared
  from the chat history panel. After sign-in, the user must explicitly approve an idempotent import;
  local records are cleared only after the server confirms success.
- Google and GitHub accounts with matching emails are not linked automatically.
- Account deletion cascades through OAuth accounts, sessions, preferences, conversations, and
  messages stored by this application.
- OAuth access, refresh, and ID tokens are not retained. Database session tokens are stored as
  keyed hashes, and rotating `AUTH_SECRET` invalidates existing sessions.
