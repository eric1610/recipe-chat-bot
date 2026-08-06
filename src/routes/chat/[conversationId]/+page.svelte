<script lang="ts">
	import type { Session } from '@auth/sveltekit';
	import type { ConversationSummary, StoredConversation, StoredMessage } from '$lib/chat/types';
	import type { AiUsageSnapshot } from '$lib/chat/usage';
	import ChatPage from '../+page.svelte';

	let { data, form }: {
		data: {
			session: Session;
			conversations: ConversationSummary[];
			aiUsage: AiUsageSnapshot;
			allergenTerms: string[];
			currentConversation: StoredConversation;
			messages: StoredMessage[];
		};
		form?: { deleteError?: string } | null;
	} = $props();
</script>

{#key `${data.currentConversation?.id}:${data.currentConversation?.updatedAt}`}
	<ChatPage {data} {form} />
{/key}
