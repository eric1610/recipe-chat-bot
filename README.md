# Recipe Chat Bot

A minimal SvelteKit foundation, deployed as a static site with GitHub Pages.

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
