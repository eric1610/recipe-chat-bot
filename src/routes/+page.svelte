<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Recipe Chat Bot — A simple Svelte foundation</title>
</svelte:head>

<div class="page-shell">
	<header class="site-header">
		<a class="brand" href={`${base}/`} aria-label="Recipe Chat Bot home">Recipe Chat Bot</a>
		<p class="status"><span aria-hidden="true"></span>Svelte foundation</p>
	</header>

	<main>
		<section aria-labelledby="page-title">
			<p class="eyebrow">A small beginning</p>
			<h1 id="page-title">A clean place to start.</h1>
			<p class="intro">
				This lightweight SvelteKit foundation is ready to grow into a thoughtful recipe
				companion.
			</p>
			<a class="repository-link" href="https://github.com/eric1610/recipe-chat-bot">
				View the repository <span aria-hidden="true">↗</span>
			</a>
		</section>
	</main>

	<footer>
		<p>Built with SvelteKit.</p>
		<p>Toronto, Canada</p>
	</footer>
</div>

<style>
	.page-shell {
		display: flex;
		box-sizing: border-box;
		flex-direction: column;
		width: min(100%, 80rem);
		min-height: 100vh;
		min-height: 100svh;
		margin: 0 auto;
		padding: clamp(1.25rem, 4vw, 3rem);
	}

	.site-header,
	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.site-header {
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #d9d9d5;
	}

	.brand {
		font-weight: 700;
		text-decoration: none;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin: 0;
		color: #5f5f5b;
	}

	.status span {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: #171717;
	}

	main {
		display: grid;
		flex: 1;
		place-items: center start;
		padding-block: clamp(5rem, 15vh, 10rem);
	}

	section {
		max-width: 52rem;
	}

	.eyebrow {
		margin: 0 0 1.25rem;
		color: #686864;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	h1 {
		max-width: 12ch;
		margin: 0;
		font-size: clamp(3.25rem, 9vw, 7.75rem);
		font-weight: 500;
		letter-spacing: -0.065em;
		line-height: 0.92;
	}

	.intro {
		max-width: 37rem;
		margin: clamp(2rem, 5vw, 3.5rem) 0 0;
		color: #4c4c49;
		font-size: clamp(1rem, 2vw, 1.25rem);
		line-height: 1.65;
	}

	.repository-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 2rem;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid currentColor;
		font-size: 0.875rem;
		font-weight: 650;
		text-decoration: none;
	}

	.repository-link span {
		transition: transform 160ms ease;
	}

	.repository-link:hover span {
		transform: translate(0.15rem, -0.15rem);
	}

	footer {
		padding-top: 1.5rem;
		border-top: 1px solid #d9d9d5;
		color: #686864;
	}

	footer p {
		margin: 0;
	}

	@media (max-width: 36rem) {
		.site-header,
		footer {
			align-items: flex-start;
			flex-direction: column;
		}

		.status {
			font-size: 0.65rem;
		}

		h1 {
			font-size: clamp(3.2rem, 18vw, 5rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.repository-link span {
			transition: none;
		}
	}
</style>
