<script lang="ts">
	import type { Session } from '@auth/sveltekit';
	import type { ConversationSummary } from '$lib/chat/types';
	import { base } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { clearGuestHistory, countGuestConversations, readGuestImport } from '$lib/chat/guest-store';
	import ChatHistory from '$lib/components/ChatHistory.svelte';
	import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
	import { SignOut } from '@auth/sveltekit/components';
	import { Dialog } from '@skeletonlabs/skeleton-svelte';

	let { data, form }: {
		data: { session: Session | null; conversations: ConversationSummary[] };
		form?: { deleteError?: string } | null;
	} = $props();
	let hasGuestHistory = $state(false);
	let importing = $state(false);
	let importError = $state('');

	$effect(() => {
		if (data.session) {
			void countGuestConversations().then((count) => (hasGuestHistory = count > 0));
		}
	});

	async function importGuestHistory() {
		importing = true;
		importError = '';
		try {
			const response = await fetch('/api/conversations/import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(await readGuestImport())
			});
			if (!response.ok) throw new Error((await response.json()).message ?? 'Import failed.');
			await clearGuestHistory();
			hasGuestHistory = false;
			await invalidateAll();
		} catch (cause) {
			importError = cause instanceof Error ? cause.message : 'Guest history could not be imported.';
		} finally {
			importing = false;
		}
	}

	const promptIdeas = [
		{
			label: 'Use what I have',
			prompt: 'Help me make dinner with tomatoes, pasta, and a handful of herbs.',
			accent: 'bg-recipe-orange text-recipe-orange-ink'
		},
		{
			label: 'Adapt a favorite',
			prompt: 'Make my favorite comfort meal lighter without losing the cozy flavor.',
			accent: 'bg-recipe-red text-recipe-red-ink'
		},
		{
			label: 'Plan something quick',
			prompt: 'Suggest a balanced weeknight dinner that takes less than 30 minutes.',
			accent: 'bg-recipe-yellow text-recipe-yellow-ink'
		}
	];
</script>

<svelte:head>
	<title>Chat — Recipe Chat Bot</title>
	<meta
		name="description"
		content="The Recipe Chat Bot conversation workspace, ready for a secure AI connection."
	/>
	<meta name="robots" content="noindex,follow" />
</svelte:head>

<div class="grid min-h-svh bg-transparent lg:grid-cols-[19rem_minmax(0,1fr)]">
	<aside
		class="hidden max-h-svh border-r border-surface-300-700 bg-surface-100-900/90 lg:sticky lg:top-0 lg:block"
		aria-labelledby="desktop-history-title"
	>
		<div class="flex h-full flex-col">
			<div class="flex h-[4.75rem] items-center border-b border-surface-300-700 px-5">
				<a
					class="flex items-center gap-3 font-bold text-surface-950-50 no-underline"
					href={`${base}/`}
				>
					<span
						class="grid size-9 place-items-center rounded-container bg-primary-500 text-primary-contrast-500"
						aria-hidden="true"
						>R</span
					>
					<span>Recipe Chat Bot</span>
				</a>
			</div>
			<h2 id="desktop-history-title" class="sr-only">Conversation history</h2>
			<div class="min-h-0 flex-1">
				<ChatHistory labelledBy="desktop-history-title" authenticated={Boolean(data.session)} conversations={data.conversations} />
			</div>
		</div>
	</aside>

	<div class="flex min-h-svh min-w-0 flex-col">
		<header
			class="sticky top-0 z-20 flex h-[4.75rem] shrink-0 items-center justify-between gap-4 border-b border-surface-300-700 bg-surface-50/90 px-4 backdrop-blur-xl dark:bg-recipe-midnight/90 sm:px-6"
		>
			<div class="flex min-w-0 items-center gap-3">
				<Dialog>
					<Dialog.Trigger
						class="btn-icon preset-tonal-surface lg:hidden"
						aria-label="Open conversation history"
					>
						<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</Dialog.Trigger>

					<Dialog.Backdrop
						class="fixed inset-0 z-40 bg-recipe-midnight/75 backdrop-blur-sm data-[state=closed]:hidden lg:hidden"
					/>
					<Dialog.Positioner
						class="pointer-events-none fixed inset-0 z-50 flex justify-start data-[state=closed]:hidden lg:hidden"
					>
						<Dialog.Content
							class="pointer-events-auto flex h-full w-[min(88vw,20rem)] flex-col bg-surface-50-950 shadow-2xl outline-none"
						>
							<div class="flex h-[4.75rem] shrink-0 items-center justify-between gap-4 border-b border-surface-300-700 px-4">
								<div>
									<Dialog.Title class="font-black text-surface-950-50">Conversation history</Dialog.Title>
									<Dialog.Description class="text-xs text-surface-600-400">Your recipe chats</Dialog.Description>
								</div>
								<Dialog.CloseTrigger class="btn-icon preset-tonal-surface" aria-label="Close conversation history">
									<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="m6 6 12 12M18 6 6 18" />
									</svg>
								</Dialog.CloseTrigger>
							</div>
							<div class="min-h-0 flex-1">
								<ChatHistory authenticated={Boolean(data.session)} conversations={data.conversations} />
							</div>
						</Dialog.Content>
					</Dialog.Positioner>
				</Dialog>

				<a
					class="btn-icon preset-tonal-surface"
					href={`${base}/`}
					aria-label="Back to landing page"
				>
					<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="m15 18-6-6 6-6" />
					</svg>
				</a>

				<div class="min-w-0">
					<p class="truncate font-black text-surface-950-50">Kitchen chat</p>
					<p class="truncate text-xs text-surface-600-400">Secure connection coming next</p>
				</div>
			</div>

			<div class="flex items-center gap-2">
				{#if data.session}
					<a class="btn preset-tonal-surface hidden font-bold sm:inline-flex" href="/settings">Preferences</a>
					<SignOut signOutPage="/signout" options={{ redirectTo: '/' }} className="btn preset-tonal-surface font-bold">
						<span slot="submitButton">Sign out</span>
					</SignOut>
				{:else}
					<a class="btn preset-filled-primary-500 font-bold" href="/signin?redirectTo=/chat">Sign in</a>
				{/if}
				<ThemeSwitch />
			</div>
		</header>

		<main class="flex min-h-0 flex-1 flex-col" aria-labelledby="chat-title">
			{#if data.session && hasGuestHistory}
				<section class="border-b border-surface-300-700 bg-secondary-500/10 px-4 py-4 sm:px-6" aria-label="Guest history import">
					<div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
						<div>
							<p class="font-bold text-surface-950-50">Bring your guest history with you?</p>
							<p class="mt-1 text-sm text-surface-700-300">Nothing leaves this browser until you choose to import it.</p>
						</div>
						<div class="flex items-center gap-2">
							<button class="btn preset-filled-primary-500 font-bold" type="button" disabled={importing} onclick={importGuestHistory}>{importing ? 'Importing…' : 'Import history'}</button>
							<button class="btn preset-tonal-surface" type="button" onclick={() => (hasGuestHistory = false)}>Not now</button>
						</div>
						{#if importError}<p class="w-full text-sm font-bold text-error-700-300" role="alert">{importError}</p>{/if}
					</div>
				</section>
			{/if}
			{#if form?.deleteError}<p class="mx-auto mt-4 w-full max-w-4xl rounded-container bg-recipe-red p-3 text-sm text-recipe-red-ink" role="alert">{form.deleteError}</p>{/if}
			<section class="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-12 sm:px-8 sm:py-16">
				<div class="mx-auto w-full max-w-3xl text-center">
					<span
						class="mx-auto grid size-16 place-items-center rounded-container bg-primary-500 text-2xl font-black text-primary-contrast-500 shadow-xl shadow-primary-500/20"
						aria-hidden="true"
						>R</span
					>
					<p class="badge preset-tonal-secondary mx-auto mt-6 w-fit px-3 py-1.5">Chat workspace preview</p>
					<h1 id="chat-title" class="mt-5 text-4xl font-black tracking-[-0.035em] text-surface-950-50 sm:text-5xl">
						What would you like to cook?
					</h1>
					<p class="mx-auto mt-4 max-w-2xl text-base leading-7 text-surface-700-300 sm:text-lg">
						Soon, you’ll be able to ask for recipes, substitutions, and practical guidance based on
						what is already in your kitchen{data.session ? ' and your saved preferences' : ''}.
					</p>
				</div>

				<div class="mt-10 grid gap-3 md:grid-cols-3" aria-label="Example recipe prompts">
					{#each promptIdeas as idea}
						<div class="card bg-surface-50-950 p-4 text-left ring-1 ring-surface-300-700 sm:p-5">
							<span class={`badge px-2.5 py-1 ${idea.accent}`}>{idea.label}</span>
							<p class="mt-4 text-sm leading-6 text-surface-700-300">“{idea.prompt}”</p>
						</div>
					{/each}
				</div>
			</section>

			<div class="sticky bottom-0 z-10 border-t border-surface-300-700 bg-surface-50/90 p-4 backdrop-blur-xl dark:bg-recipe-midnight/90 sm:p-6">
				<form class="mx-auto max-w-4xl" aria-describedby="chat-availability">
					<label class="sr-only" for="chat-message">Message Recipe Chat Bot</label>
					<div class="flex items-end gap-3 rounded-container bg-surface-50-950 p-3 ring-1 ring-surface-300-700">
						<textarea
							id="chat-message"
							class="min-h-14 flex-1 resize-none bg-transparent px-2 py-2 text-surface-950-50 outline-none placeholder:text-surface-600-400"
							placeholder="Secure recipe chat is coming soon"
							rows="1"
							disabled
						></textarea>
						<button class="btn-icon preset-filled-primary-500" type="submit" disabled aria-label="Send message">
							<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="m5 12 14-7-4 14-3-6-7-1Z" />
							</svg>
						</button>
					</div>
					<p id="chat-availability" class="mt-3 text-center text-xs leading-5 text-surface-600-400">
						Messaging is disabled until the AI backend is connected. {data.session
							? 'Your account and history storage are ready.'
							: 'Future guest history will stay in IndexedDB until you choose to import it.'}
					</p>
				</form>
			</div>
		</main>
	</div>
</div>
