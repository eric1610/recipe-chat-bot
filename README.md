# Recipe Chat Bot

A SvelteKit landing page using Skeleton 5's Modern theme, Tailwind CSS, and a system-aware
light/dark mode. It is deployed as a static site with GitHub Pages.

## Design palette

Skeleton's Modern theme provides the primary pink, secondary cyan, tertiary teal, and violet
surface scales. The project's additional warm recipe accents are maintained in
`src/lib/styles/palette.css`: light orange (`#FDBA74`), light red (`#FCA5A5`), and light yellow
(`#FDE68A`).

## Develop locally

Install dependencies and start the development server:

```sh
pnpm install
pnpm run dev
```

Run the TypeScript check and production build:

```sh
pnpm run check
pnpm run build
```

> **TypeScript compatibility:** the project installs TypeScript 7.0.2 as requested. SvelteKit
> currently declares support for TypeScript 5 and 6, and its generated declarations are not yet
> accepted by the TypeScript 7 compiler. The `check` script therefore runs the pinned Svelte
> checker with TypeScript 6.0.3 until SvelteKit adds TypeScript 7 support; the production app still
> builds with the project's installed toolchain.

## Publish with GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds and publishes the site whenever `main` is
updated.

For the first deployment:

1. Push the `main` branch to `git@github.com:eric1610/recipe-chat-bot.git`.
2. Open the repository on GitHub and go to **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. If the first workflow ran before Pages was enabled, rerun it from the **Actions** tab.
5. Visit <https://eric1610.github.io/recipe-chat-bot/>.

Future pushes to `main` deploy automatically.
