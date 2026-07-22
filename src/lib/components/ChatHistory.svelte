<script lang="ts">
	import type { ConversationSummary, StoredConversation } from '$lib/chat/types';
	import { deleteGuestConversation, listGuestConversations } from '$lib/chat/guest-store';

	let {
		labelledBy,
		authenticated = false,
		conversations = [],
		refreshKey = 0,
		onNew,
		onSelect,
		onClearGuest
	}: {
		labelledBy?: string;
		authenticated?: boolean;
		conversations?: ConversationSummary[];
		refreshKey?: number;
		onNew?: () => void;
		onSelect?: (conversation: ConversationSummary) => void;
		onClearGuest?: () => Promise<void>;
	} = $props();

	let guestConversations = $state<StoredConversation[]>([]);
	let loadingGuestHistory = $state(false);
	let guestError = $state('');

	async function loadGuestHistory() {
		if (authenticated) return;
		loadingGuestHistory = true;
		try {
			guestConversations = await listGuestConversations();
		} catch {
			guestError = 'Guest history is unavailable in this browser.';
		} finally {
			loadingGuestHistory = false;
		}
	}

	$effect(() => {
		refreshKey;
		if (!authenticated) void loadGuestHistory();
	});

	async function removeGuestConversation(id: string) {
		await deleteGuestConversation(id);
		guestConversations = guestConversations.filter((conversation) => conversation.id !== id);
	}

	let visibleConversations = $derived(authenticated ? conversations : guestConversations);

	async function confirmClearGuestHistory() {
		if (!onClearGuest || !confirm('Clear all guest conversations from this browser tab?')) return;
		await onClearGuest();
		guestConversations = [];
	}
</script>

<div class="flex h-full min-h-0 flex-col" aria-labelledby={labelledBy}>
	<div class="border-b border-surface-300-700 p-4">
		<button class="btn w-full preset-tonal-primary font-bold" type="button" onclick={onNew} disabled={!onNew}>
			<span aria-hidden="true">＋</span>
			New conversation
		</button>
	</div>

	<div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
		<p class="mb-3 text-xs font-bold tracking-[0.14em] text-surface-600-400 uppercase">
			Recent chats
		</p>

		{#if loadingGuestHistory}
			<p class="p-4 text-sm text-surface-600-400" role="status">Loading guest history…</p>
		{:else if guestError}
			<p class="rounded-container bg-recipe-red p-3 text-sm text-recipe-red-ink" role="alert">{guestError}</p>
		{:else if visibleConversations.length > 0}
			<ul class="grid gap-2">
				{#each visibleConversations as conversation}
					<li class="flex items-center gap-2 rounded-container bg-surface-100-900 p-2 ring-1 ring-surface-300-700">
						<button class="min-w-0 flex-1 px-2 py-1 text-left" type="button" onclick={() => onSelect?.(conversation)}>
							<p class="truncate text-sm font-bold text-surface-950-50">{conversation.title}</p>
							<p class="mt-1 text-xs text-surface-600-400">{new Date(conversation.updatedAt).toLocaleDateString()}</p>
						</button>
						{#if authenticated}
							<form method="POST" action="?/deleteConversation">
								<input type="hidden" name="conversationId" value={conversation.id} />
								<button class="btn-icon preset-tonal-surface" type="submit" aria-label={`Delete ${conversation.title}`}>×</button>
							</form>
						{:else}
							<button class="btn-icon preset-tonal-surface" type="button" onclick={() => removeGuestConversation(conversation.id)} aria-label={`Delete ${conversation.title}`}>×</button>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<div class="grid flex-1 place-items-center rounded-container border border-dashed border-surface-400-600 bg-surface-100-900/60 p-6 text-center">
				<div class="max-w-48">
					<span class="mx-auto grid size-12 place-items-center rounded-full bg-secondary-500/20 text-xl text-secondary-700-300" aria-hidden="true">☰</span>
					<p class="mt-4 font-bold text-surface-950-50">No conversations yet</p>
					<p class="mt-2 text-sm leading-6 text-surface-700-300">Your recipe chats will appear here after you send a message.</p>
				</div>
			</div>
		{/if}
	</div>

	{#if !authenticated && visibleConversations.length > 0}
		<div class="border-t border-surface-300-700 px-4 py-3">
			<button class="btn w-full preset-tonal-error font-bold" type="button" onclick={confirmClearGuestHistory}>
				Clear guest history
			</button>
		</div>
	{/if}

	<p class="border-t border-surface-300-700 p-4 text-xs leading-5 text-surface-600-400">
		{authenticated ? 'History is securely scoped to your account.' : 'Guest history expires after 12 hours without activity and may survive a restored browser session.'}
	</p>
</div>
