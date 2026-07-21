<script lang="ts">
	let { data }: { data: { error: string } } = $props();
	let accountNotLinked = $derived(data.error === 'OAuthAccountNotLinked');
</script>

<svelte:head>
	<title>Sign-in problem — Recipe Chat Bot</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="grid min-h-svh place-items-center px-5 py-12">
	<section class="card w-full max-w-lg bg-surface-50-950 p-7 text-center shadow-2xl ring-1 ring-surface-300-700 sm:p-10">
		<span class="mx-auto grid size-14 place-items-center rounded-full bg-recipe-red text-xl text-recipe-red-ink" aria-hidden="true">!</span>
		<h1 class="mt-6 text-3xl font-black text-surface-950-50">We couldn’t sign you in</h1>
		<p class="mt-4 leading-7 text-surface-700-300">
			{accountNotLinked
				? 'An account already uses this email. Sign in with the provider you originally chose; Google and GitHub identities are not linked automatically.'
				: 'The authentication service could not complete that request. Please try again.'}
		</p>
		<a class="btn btn-lg preset-filled-primary-500 mt-8 font-bold" href="/signin">Back to sign in</a>
	</section>
</main>
