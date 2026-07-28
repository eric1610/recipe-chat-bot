<script lang="ts">
	import type { ConversationSummary } from '$lib/chat/types';
	import { base } from '$app/paths';

	let {
		labelledBy,
		conversations = [],
		activeConversationId
	}: {
		labelledBy?: string;
		conversations?: ConversationSummary[];
		activeConversationId?: string;
	} = $props();
</script>

<div class="flex h-full min-h-0 flex-col" aria-labelledby={labelledBy}>
	<div class="border-b border-surface-300-700 p-4">
		<a class="btn w-full preset-tonal-primary font-bold" href={`${base}/chat`}>
			<span aria-hidden="true">＋</span>
			New conversation
		</a>
	</div>

	<div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
		<p class="mb-3 text-xs font-bold tracking-[0.14em] text-surface-600-400 uppercase">
			Recent chats
		</p>

		{#if conversations.length > 0}
			<ul class="grid gap-2">
				{#each conversations as conversation}
					<li
						class={`flex items-center gap-2 rounded-container p-2 ring-1 ${conversation.id === activeConversationId ? 'bg-primary-500/15 ring-primary-500' : 'bg-surface-100-900 ring-surface-300-700'}`}
					>
						<a
							class="min-w-0 flex-1 px-2 py-1 no-underline"
							href={`${base}/chat/${conversation.id}`}
							aria-current={conversation.id === activeConversationId ? 'page' : undefined}
						>
							<p class="truncate text-sm font-bold text-surface-950-50">{conversation.title}</p>
							<p class="mt-1 text-xs text-surface-600-400">
								{new Date(conversation.updatedAt).toLocaleDateString()}
							</p>
						</a>
						<form method="POST" action="?/deleteConversation">
							<input type="hidden" name="conversationId" value={conversation.id} />
							<button
								class="btn-icon preset-tonal-surface"
								type="submit"
								aria-label={`Delete ${conversation.title}`}>×</button
							>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<div
				class="grid flex-1 place-items-center rounded-container border border-dashed border-surface-400-600 bg-surface-100-900/60 p-6 text-center"
			>
				<div class="max-w-48">
					<span
						class="mx-auto grid size-12 place-items-center rounded-full bg-secondary-500/20 text-xl text-secondary-700-300"
						aria-hidden="true">☰</span
					>
					<p class="mt-4 font-bold text-surface-950-50">No conversations yet</p>
					<p class="mt-2 text-sm leading-6 text-surface-700-300">
						Your recipe chats will appear here after you send a message.
					</p>
				</div>
			</div>
		{/if}
	</div>

	<p class="border-t border-surface-300-700 p-4 text-xs leading-5 text-surface-600-400">
		History is securely stored in your account.
	</p>
</div>
