import { getContext, setContext } from 'svelte';

export interface PendingChatRetry {
	conversationId: string;
	userMessageId: string;
	notice: string;
}

class ChatRetryState {
	current = $state<PendingChatRetry | null>(null);

	set(value: PendingChatRetry) {
		this.current = value;
	}

	clear() {
		this.current = null;
	}
}

const chatRetryStateKey = Symbol('chat-retry-state');

export function provideChatRetryState(): ChatRetryState {
	return setContext(chatRetryStateKey, new ChatRetryState());
}

export function useChatRetryState(): ChatRetryState {
	return getContext<ChatRetryState>(chatRetryStateKey);
}
