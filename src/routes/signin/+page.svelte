<script lang="ts">
	import { SignIn } from '@auth/sveltekit/components';
	let { data }: { data: { redirectTo: string } } = $props();
</script>

<svelte:head>
	<title>Sign in — Recipe Chat Bot</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="grid min-h-svh place-items-center px-5 py-12">
	<section class="card w-full max-w-md bg-surface-50-950 p-6 shadow-2xl ring-1 ring-surface-300-700 sm:p-8" aria-labelledby="sign-in-title">
		<a class="flex items-center gap-3 font-bold text-surface-950-50 no-underline" href="/">
			<span class="grid size-10 place-items-center rounded-container bg-primary-500 text-primary-contrast-500" aria-hidden="true">R</span>
			Recipe Chat Bot
		</a>

		<h1 id="sign-in-title" class="mt-8 text-3xl font-black text-surface-950-50">Welcome to your kitchen</h1>
		<p class="mt-3 leading-7 text-surface-700-300">Sign in to keep recipe conversations and preferences available across devices.</p>

		<div class="mt-8 grid gap-3">
			<SignIn provider="google" signInPage="/signin" options={{ redirectTo: data.redirectTo }} className="btn btn-lg w-full preset-filled-primary-500 font-bold">
				<span slot="submitButton">Continue with Google</span>
			</SignIn>
			<SignIn provider="github" signInPage="/signin" options={{ redirectTo: data.redirectTo }} className="btn btn-lg w-full preset-tonal-surface font-bold">
				<span slot="submitButton">Continue with GitHub</span>
			</SignIn>
		</div>

		<p class="mt-6 text-xs leading-5 text-surface-600-400">For your security, accounts with matching provider emails are not linked automatically.</p>
	</section>
</main>
