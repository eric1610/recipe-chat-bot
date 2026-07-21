<script lang="ts">
	import { base } from '$app/paths';
	import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';

	const features = [
		{
			title: 'Cook from what you have',
			copy: 'Turn the ingredients already in your kitchen into a practical place to begin.',
			accent: 'bg-recipe-orange text-recipe-orange-ink',
			icon: '01'
		},
		{
			title: 'Keep every step clear',
			copy: 'Get calm, concise guidance that is easy to follow while your hands are busy.',
			accent: 'bg-recipe-red text-recipe-red-ink',
			icon: '02'
		},
		{
			title: 'Make it your own',
			copy: 'Adapt recipes around preferences, dietary needs, portions, and available time.',
			accent: 'bg-recipe-yellow text-recipe-yellow-ink',
			icon: '03'
		}
	];
</script>

<svelte:head>
	<title>Recipe Chat Bot — A thoughtful kitchen companion</title>
</svelte:head>

<div class="relative min-h-svh overflow-hidden">
	<div
		class="pointer-events-none absolute -top-32 left-[55%] -z-10 size-[34rem] rounded-full bg-primary-500/20 blur-3xl dark:bg-primary-500/12"
		aria-hidden="true"
	></div>
	<div
		class="pointer-events-none absolute top-[30rem] -left-48 -z-10 size-[30rem] rounded-full bg-secondary-500/18 blur-3xl dark:bg-secondary-500/10"
		aria-hidden="true"
	></div>

	<header class="mx-auto flex w-full max-w-7xl items-center justify-between gap-5 px-5 py-6 sm:px-8 lg:px-12">
		<a class="flex items-center gap-3 font-bold text-surface-950-50 no-underline" href={`${base}/`}>
			<span
				class="grid size-10 place-items-center rounded-container bg-primary-500 text-lg text-primary-contrast-500 shadow-lg shadow-primary-500/20"
				aria-hidden="true"
				>R</span
			>
			<span>Recipe Chat Bot</span>
		</a>

		<nav class="flex items-center gap-3 sm:gap-5" aria-label="Primary navigation">
			<a
				class="hidden text-sm font-semibold text-surface-700-300 no-underline transition-colors hover:text-primary-500 sm:inline"
				href="https://github.com/eric1610/recipe-chat-bot"
				>GitHub</a
			>
			<a class="btn preset-tonal-surface font-bold" href="/signin?redirectTo=/chat">Sign in</a>
			<ThemeSwitch />
		</nav>
	</header>

	<main>
		<section
			class="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.08fr_0.92fr] lg:px-12 lg:py-28"
			aria-labelledby="page-title"
		>
			<div>
				<p class="badge preset-tonal-primary mb-6 w-fit px-3 py-1.5">Skeleton 5 · SvelteKit</p>
				<h1
					id="page-title"
					class="max-w-3xl text-5xl leading-[0.98] font-black tracking-[-0.04em] text-surface-950-50 sm:text-6xl lg:text-7xl"
				>
					A brighter way to decide <span class="text-primary-500">what's for dinner.</span>
				</h1>
				<p class="mt-7 max-w-2xl text-lg leading-8 text-surface-700-300 sm:text-xl">
					A friendly starting point for recipes, substitutions, and step-by-step help—built to
					make everyday cooking feel less complicated.
				</p>

				<div class="mt-9 flex flex-wrap gap-3">
					<a
						class="btn btn-lg preset-filled-primary-500 font-bold"
						href={`${base}/chat/`}
					>
						Start chatting <span aria-hidden="true">→</span>
					</a>
					<a
						class="btn btn-lg preset-outlined-surface-400-600 font-bold"
						href="https://github.com/eric1610/recipe-chat-bot"
					>
						View the repository <span aria-hidden="true">↗</span>
					</a>
				</div>

				<div class="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-surface-700-300">
					<span class="flex items-center gap-2"><span class="size-2 rounded-full bg-secondary-500"></span>Adaptive theme</span>
					<span class="flex items-center gap-2"><span class="size-2 rounded-full bg-tertiary-500"></span>Accessible controls</span>
					<span class="flex items-center gap-2"><span class="size-2 rounded-full bg-recipe-yellow"></span>Warm accents</span>
				</div>
			</div>

			<aside class="card preset-tonal-surface relative p-4 shadow-2xl shadow-surface-950/15 sm:p-6" aria-label="Recipe preview">
				<div class="rounded-container bg-surface-50-950 p-5 ring-1 ring-surface-300-700 sm:p-7">
					<div class="flex items-start justify-between gap-4">
						<div>
							<p class="text-xs font-bold tracking-[0.16em] text-primary-500 uppercase">Tonight's idea</p>
							<h2 class="mt-2 text-2xl font-black text-surface-950-50 sm:text-3xl">Golden tomato pasta</h2>
						</div>
						<span class="badge bg-recipe-yellow px-2.5 py-1 text-recipe-yellow-ink">25 min</span>
					</div>

					<div class="mt-7 grid grid-cols-3 gap-2" aria-label="Recipe qualities">
						<div class="rounded-container bg-recipe-orange p-3 text-recipe-orange-ink">
							<strong class="block text-lg">Easy</strong><span class="text-xs">one pan</span>
						</div>
						<div class="rounded-container bg-recipe-red p-3 text-recipe-red-ink">
							<strong class="block text-lg">Rich</strong><span class="text-xs">tomato</span>
						</div>
						<div class="rounded-container bg-recipe-yellow p-3 text-recipe-yellow-ink">
							<strong class="block text-lg">Bright</strong><span class="text-xs">lemon</span>
						</div>
					</div>

					<div class="mt-7 border-t border-surface-300-700 pt-6">
						<p class="text-sm font-bold text-surface-950-50">Start with what you have</p>
						<div class="mt-3 flex flex-wrap gap-2">
							<span class="chip preset-tonal-primary">tomatoes</span>
							<span class="chip preset-tonal-secondary">pasta</span>
							<span class="chip preset-tonal-tertiary">herbs</span>
						</div>
					</div>
				</div>
			</aside>
		</section>

		<section id="ingredients" class="mx-auto w-full max-w-7xl scroll-mt-8 px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28" aria-labelledby="feature-title">
			<div class="mb-8 max-w-2xl">
				<p class="text-sm font-bold tracking-[0.16em] text-secondary-700-300 uppercase">Built for real kitchens</p>
				<h2 id="feature-title" class="mt-3 text-3xl font-black text-surface-950-50 sm:text-4xl">A helpful foundation, ready to grow.</h2>
			</div>

			<div class="grid gap-4 md:grid-cols-3">
				{#each features as feature}
					<article class="card bg-surface-50-950 p-6 ring-1 ring-surface-300-700 sm:p-7">
						<span class={`grid size-11 place-items-center rounded-token text-sm font-black ${feature.accent}`}>{feature.icon}</span>
						<h3 class="mt-6 text-xl font-black text-surface-950-50">{feature.title}</h3>
						<p class="mt-3 leading-7 text-surface-700-300">{feature.copy}</p>
					</article>
				{/each}
			</div>
		</section>
	</main>

	<footer class="mx-auto flex w-full max-w-7xl flex-col gap-3 border-t border-surface-300-700 px-5 py-8 text-sm text-surface-700-300 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
		<p>Recipe Chat Bot · Built with SvelteKit and Skeleton 5.</p>
		<p>Toronto, Canada</p>
	</footer>
</div>
