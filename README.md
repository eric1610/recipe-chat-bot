# Recipe Chat Bot

A SvelteKit and Skeleton 5 recipe-chat foundation with Auth.js, Google and GitHub OAuth,
Neon Postgres history, user cooking preferences, and browser-only IndexedDB guest storage.
AI message generation is intentionally not connected yet.

## Stack

- SvelteKit 2, Svelte 5, TypeScript 7, Skeleton 5, and Tailwind CSS 4
- Auth.js `@auth/sveltekit` 1.11.3 with database sessions
- Drizzle ORM and Neon serverless Postgres
- IndexedDB through `idb` for guest conversation data
- Vercel server runtime and GitHub Actions validation

Auth.js currently labels its SvelteKit integration experimental even though 1.11.3 is the
latest stable npm release. Review Auth.js release notes before future upgrades.

## Local setup

Install dependencies and copy the environment template:

```sh
pnpm install
cp .env.example .env
```

Create an Auth.js secret and place it in `.env`:

```sh
openssl rand -hex 32
```

Create a free Neon project, copy its pooled connection string into `DATABASE_URL`, and apply the
committed migration:

```sh
pnpm run db:migrate
```

Create Google and GitHub OAuth applications and configure these callbacks for local development:

```text
http://localhost:5173/auth/callback/google
http://localhost:5173/auth/callback/github
```

Add the client IDs and secrets to `.env`, then start the app:

```sh
pnpm run dev
```

GitHub OAuth apps accept one callback URL, so use separate local and production OAuth apps.
Google can register both callback URLs on one web client.

## Validate changes

```sh
pnpm run check
pnpm run test
pnpm run db:check
pnpm run build
```

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
   `AUTH_GITHUB_SECRET` to the Vercel project environment.
4. Run `pnpm run db:migrate` against the production `DATABASE_URL` once before the first sign-in.
5. Deploy through Vercel's Git integration. GitHub Actions validates checks, tests, and builds but
   no longer publishes to GitHub Pages.

Vercel Hobby is intended for personal, non-commercial projects. Choose a suitable paid or
commercial host before using the application commercially.

## Data behavior

- Signed-in conversations and preferences are scoped to the Auth.js session user ID in Neon.
- Guest history stays in IndexedDB. After sign-in, the user must explicitly approve an idempotent
  import; local records are cleared only after the server confirms success.
- Google and GitHub accounts with matching emails are not linked automatically.
- Account deletion cascades through OAuth accounts, sessions, preferences, conversations, and
  messages stored by this application.
