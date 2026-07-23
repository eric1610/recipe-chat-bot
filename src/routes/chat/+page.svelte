<script lang="ts">
	import type { Session } from '@auth/sveltekit';
	import type { ConversationSummary, StoredConversation, StoredMessage } from '$lib/chat/types';
	import type { AiUsageSnapshot } from '$lib/chat/usage';
	import { shouldSubmitComposer } from '$lib/chat/composer';
	import { base } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport, type UIMessage } from 'ai';
	import {
		clearGuestHistory,
		countGuestConversations,
		listGuestConversations,
		listGuestMessages,
		readGuestImport
	} from '$lib/chat/guest-store';
	import ChatHistory from '$lib/components/ChatHistory.svelte';
	import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
	import { SignOut } from '@auth/sveltekit/components';
	import { Dialog } from '@skeletonlabs/skeleton-svelte';
	import { onMount } from 'svelte';

	let { data, form }: {
		data: {
			session: Session | null;
			conversations: ConversationSummary[];
			aiUsage: AiUsageSnapshot | null;
		};
		form?: { deleteError?: string } | null;
	} = $props();
	type RecipeUiMessage = UIMessage<{ position?: number; createdAt?: string }>;
	let hasGuestHistory = $state(false);
	let importing = $state(false);
	let importError = $state('');
	let currentConversation = $state<StoredConversation | null>(null);
	let draft = $state('');
	let pendingDraft = $state('');
	let chatError = $state('');
	let aiUsage = $state<AiUsageSnapshot | null>(null);
	let historyRevision = $state(0);
	let composer: HTMLTextAreaElement;

	const chat = new Chat<RecipeUiMessage>({
		transport: new DefaultChatTransport<RecipeUiMessage>({
			api: `${base}/api/chat`,
			prepareSendMessagesRequest: ({ messages, body }) => {
				const message = messages.findLast((candidate) => candidate.role === 'user');
				const content = message?.parts
					.filter((part) => part.type === 'text')
					.map((part) => part.text)
					.join('') ?? '';
				return {
					body: {
						conversationId: body?.conversationId,
						message: { id: message?.id, content }
					}
				};
			}
		}),
		onError: (cause) => {
			chatError = cause.message;
			draft = pendingDraft;
			void refreshAfterGeneration(true);
		},
		onFinish: ({ isAbort, isError }) => {
			if (isAbort) chatError = 'Response stopped. Your message remains saved.';
			if (!isError) pendingDraft = '';
			void refreshAfterGeneration(isError);
		}
	});

	let sending = $derived(chat.status === 'submitted' || chat.status === 'streaming');
	let quotaExhausted = $derived(
		!aiUsage || aiUsage.user.state === 'exhausted' || aiUsage.shared.state === 'exhausted'
	);

	$effect(() => {
		aiUsage = data.aiUsage;
		if (data.session) {
			void countGuestConversations().then((count) => (hasGuestHistory = count > 0));
		}
	});

	onMount(() => {
		if (!data.session) {
			void listGuestConversations().then(async ([latest]) => {
				if (latest) await selectConversation(latest);
			});
		}
	});

	function startConversation() {
		currentConversation = null;
		chat.messages = [];
		chatError = '';
		draft = '';
		composer?.focus();
	}

	async function clearGuestSession() {
		await clearGuestHistory();
		hasGuestHistory = false;
		historyRevision += 1;
		startConversation();
	}

	async function selectConversation(conversation: ConversationSummary) {
		chatError = '';
		currentConversation = { ...conversation, archivedAt: null };
		try {
			let messages: StoredMessage[];
			if (data.session) {
				const response = await fetch(`/api/conversations/${conversation.id}`);
				if (!response.ok) throw new Error('This conversation could not be loaded.');
				messages = (await response.json()).messages;
			} else {
				messages = await listGuestMessages(conversation.id);
			}
			chat.messages = messages.map(toUiMessage);
		} catch (cause) {
			chatError = cause instanceof Error ? cause.message : 'This conversation could not be loaded.';
		}
	}

	function usePrompt(prompt: string) {
		draft = prompt;
		composer?.focus();
	}

	function toUiMessage(message: StoredMessage): RecipeUiMessage {
		return {
			id: message.id,
			role: message.role,
			parts: [{ type: 'text', text: message.content }],
			metadata: { position: message.position, createdAt: message.createdAt }
		};
	}

	function messageText(message: RecipeUiMessage): string {
		return message.parts
			.filter((part) => part.type === 'text')
			.map((part) => part.text)
			.join('');
	}

	function localConversation(content: string): StoredConversation {
		const now = new Date().toISOString();
		return currentConversation
			? { ...currentConversation, updatedAt: now }
			: {
					id: crypto.randomUUID(),
					title: content.length > 80 ? `${content.slice(0, 77)}…` : content,
					createdAt: now,
					updatedAt: now,
					archivedAt: null
				};
	}

	async function refreshUsage() {
		if (!data.session) return;
		const response = await fetch(`${base}/api/ai/usage`);
		if (response.ok) aiUsage = await response.json();
	}

	async function reloadCurrentConversation() {
		if (!data.session || !currentConversation) return;
		const response = await fetch(`${base}/api/conversations/${currentConversation.id}`);
		if (response.ok) {
			chat.messages = (await response.json()).messages.map(toUiMessage);
		} else if (response.status === 404) {
			currentConversation = null;
			chat.messages = [];
		}
	}

	async function refreshAfterGeneration(reloadConversation: boolean) {
		await refreshUsage();
		if (reloadConversation) await reloadCurrentConversation();
		await invalidateAll();
		historyRevision += 1;
	}

	async function sendMessage(event: SubmitEvent) {
		event.preventDefault();
		const content = draft.trim();
		if (!content || sending || !data.session || quotaExhausted) return;

		chatError = '';
		pendingDraft = content;
		const conversation = localConversation(content);
		currentConversation = conversation;
		draft = '';
		try {
			await chat.sendMessage(
				{
					id: crypto.randomUUID(),
					role: 'user',
					parts: [{ type: 'text', text: content }],
					metadata: { createdAt: new Date().toISOString() }
				},
				{ body: { conversationId: conversation.id } }
			);
		} catch (cause) {
			chatError = cause instanceof Error ? cause.message : 'The recipe assistant could not respond.';
			draft = content;
		}
	}

	function handleComposerKeydown(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
		if (!shouldSubmitComposer(event) || sending || !draft.trim()) return;
		event.preventDefault();
		event.currentTarget.form?.requestSubmit();
	}

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
				<ChatHistory
					labelledBy="desktop-history-title"
					authenticated={Boolean(data.session)}
					conversations={data.conversations}
					refreshKey={historyRevision}
					onNew={startConversation}
					onSelect={selectConversation}
					onClearGuest={clearGuestSession}
				/>
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
								<ChatHistory
									authenticated={Boolean(data.session)}
									conversations={data.conversations}
									refreshKey={historyRevision}
									onNew={startConversation}
									onSelect={selectConversation}
									onClearGuest={clearGuestSession}
								/>
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
					<p class="truncate text-xs text-surface-600-400">{data.session ? 'Saved to your account' : 'Guest session · local only'}</p>
				</div>
			</div>

			<div class="flex items-center gap-2">
				{#if data.session}
					<a class="btn preset-tonal-surface hidden font-bold sm:inline-flex" href="/settings">Preferences</a>
					<SignOut signOutPage="signout" options={{ redirectTo: '/' }} className="btn preset-tonal-surface font-bold">
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
			<section class="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-10 sm:px-8 sm:py-14">
				{#if chat.messages.length === 0}
					<div class="my-auto">
						<div class="mx-auto w-full max-w-3xl text-center">
							<span
								class="mx-auto grid size-16 place-items-center rounded-container bg-primary-500 text-2xl font-black text-primary-contrast-500 shadow-xl shadow-primary-500/20"
								aria-hidden="true"
								>R</span
							>
							<p class="badge preset-tonal-secondary mx-auto mt-6 w-fit px-3 py-1.5">Recipe conversation</p>
							<h1 id="chat-title" class="mt-5 text-4xl font-black tracking-[-0.035em] text-surface-950-50 sm:text-5xl">
								What would you like to cook?
							</h1>
							<p class="mx-auto mt-4 max-w-2xl text-base leading-7 text-surface-700-300 sm:text-lg">
								{data.session
									? 'Start a streamed recipe conversation with the AI assistant.'
									: 'Sign in to ask the AI assistant. Existing guest history remains available in this browser.'}
							</p>
						</div>

						<div class="mt-10 grid gap-3 md:grid-cols-3" aria-label="Example recipe prompts">
							{#each promptIdeas as idea}
								<button class="card bg-surface-50-950 p-4 text-left ring-1 ring-surface-300-700 transition hover:-translate-y-0.5 hover:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 sm:p-5" type="button" disabled={!data.session || quotaExhausted} onclick={() => usePrompt(idea.prompt)}>
									<span class={`badge px-2.5 py-1 ${idea.accent}`}>{idea.label}</span>
									<p class="mt-4 text-sm leading-6 text-surface-700-300">“{idea.prompt}”</p>
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<h1 id="chat-title" class="sr-only">{currentConversation?.title ?? 'Recipe conversation'}</h1>
					<div class="grid gap-5" aria-live="polite">
						{#each chat.messages as message (message.id)}
							<article class={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
								<div class={`max-w-[85%] rounded-container px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${message.role === 'user' ? 'bg-primary-500 text-primary-contrast-500' : 'bg-surface-100-900 text-surface-950-50 ring-1 ring-surface-300-700'}`}>
									<p class="whitespace-pre-wrap">{messageText(message)}</p>
								</div>
							</article>
						{/each}
						{#if chat.status === 'submitted'}
							<p class="text-sm text-surface-600-400" role="status">Finding a privacy-compatible free model…</p>
						{/if}
					</div>
				{/if}
				{#if chatError}<p class="mt-6 rounded-container bg-recipe-red p-3 text-sm font-bold text-recipe-red-ink" role="alert">{chatError}</p>{/if}
			</section>

			<div class="sticky bottom-0 z-10 border-t border-surface-300-700 bg-surface-50/90 p-4 backdrop-blur-xl dark:bg-recipe-midnight/90 sm:p-6">
				{#if data.session && aiUsage}
					<div class="mx-auto mb-3 flex max-w-4xl flex-wrap items-center justify-between gap-2 text-xs" aria-live="polite">
						<p class="font-bold text-surface-700-300">
							{aiUsage.user.limit === null
								? `${aiUsage.user.used} AI requests today · no individual cap`
								: `${aiUsage.user.used} of ${aiUsage.user.limit} AI requests used today`}
						</p>
						<div class="text-right">
							{#if aiUsage.user.state === 'near'}
								<p class="font-bold text-recipe-orange-ink dark:text-recipe-yellow">You are close to your daily limit.</p>
							{:else if aiUsage.user.state === 'exhausted'}
								<p class="font-bold text-error-700-300">Your daily AI limit has been reached.</p>
							{/if}
							{#if aiUsage.shared.state === 'near'}
								<p class="font-bold text-recipe-orange-ink dark:text-recipe-yellow">Shared AI capacity is running low.</p>
							{:else if aiUsage.shared.state === 'critical'}
								<p class="font-bold text-error-700-300">Very few shared AI requests remain today.</p>
							{:else if aiUsage.shared.state === 'exhausted'}
								<p class="font-bold text-error-700-300">Today's shared AI limit has been reached.</p>
							{:else}
								<p class="text-surface-600-400">Shared AI capacity is available.</p>
							{/if}
						</div>
					</div>
				{/if}
				<form class="mx-auto max-w-4xl" aria-describedby="chat-availability" onsubmit={sendMessage}>
					<label class="sr-only" for="chat-message">Message Recipe Chat Bot</label>
					<div class="flex items-end gap-3 rounded-container bg-surface-50-950 p-3 ring-1 ring-surface-300-700">
						<textarea
							id="chat-message"
							class="min-h-14 flex-1 resize-none bg-transparent px-2 py-2 text-surface-950-50 outline-none placeholder:text-surface-600-400"
							placeholder="Ask about a recipe, substitution, or meal idea"
							rows="1"
							bind:this={composer}
							bind:value={draft}
							onkeydown={handleComposerKeydown}
							maxlength="8000"
							disabled={!data.session || quotaExhausted}
						></textarea>
						{#if sending}
							<button class="btn-icon preset-tonal-error" type="button" onclick={() => chat.stop()} aria-label="Stop response">
								<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v10H7z" /></svg>
							</button>
						{:else}
							<button class="btn-icon preset-filled-primary-500" type="submit" disabled={!data.session || quotaExhausted || !draft.trim()} aria-label="Send message">
								<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="m5 12 14-7-4 14-3-6-7-1Z" />
								</svg>
							</button>
						{/if}
					</div>
					<p id="chat-availability" class="mt-3 text-center text-xs leading-5 text-surface-600-400">
						{#if data.session && aiUsage}
							Messages and completed AI responses are saved to your account. The app-tracked allowance resets at {new Date(aiUsage.shared.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}.
						{:else}
							<a class="font-bold text-primary-600-400 underline" href={`${base}/signin?redirectTo=/chat`}>Sign in</a> to send a message. Guest history stays in this browser tab and is never sent automatically.
						{/if}
					</p>
				</form>
			</div>
		</main>
	</div>
</div>
