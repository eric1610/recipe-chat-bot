import type { ConversationImport, StoredConversation, StoredMessage } from '$lib/chat/types';

const storageKey = 'recipe-chat-bot-guest-history';
export const guestHistoryTtlMs = 12 * 60 * 60 * 1000;

interface GuestHistoryEnvelope extends ConversationImport {
	version: 2;
	lastActivityAt: string;
}

function getStorage(): Storage {
	if (typeof sessionStorage === 'undefined') {
		throw new Error('Guest history is only available in the browser.');
	}

	return sessionStorage;
}

function readHistory(): ConversationImport {
	const value = getStorage().getItem(storageKey);
	if (!value) return { conversations: [], messages: [] };

	try {
		const parsed = JSON.parse(value) as Partial<GuestHistoryEnvelope>;
		const history = {
			conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
			messages: Array.isArray(parsed.messages) ? parsed.messages : []
		};
		if (parsed.version !== 2 || typeof parsed.lastActivityAt !== 'string') {
			writeHistory(history);
			return history;
		}
		const lastActivity = Date.parse(parsed.lastActivityAt);
		if (!Number.isFinite(lastActivity) || Date.now() - lastActivity >= guestHistoryTtlMs) {
			getStorage().removeItem(storageKey);
			return { conversations: [], messages: [] };
		}
		return history;
	} catch {
		getStorage().removeItem(storageKey);
		return { conversations: [], messages: [] };
	}
}

function writeHistory(history: ConversationImport): void {
	const envelope: GuestHistoryEnvelope = {
		version: 2,
		lastActivityAt: new Date().toISOString(),
		...history
	};
	getStorage().setItem(storageKey, JSON.stringify(envelope));
}

export async function listGuestConversations(): Promise<StoredConversation[]> {
	return readHistory().conversations.toSorted((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt)
	);
}

export async function listGuestMessages(conversationId: string): Promise<StoredMessage[]> {
	return readHistory()
		.messages.filter((message) => message.conversationId === conversationId)
		.toSorted((left, right) => left.position - right.position);
}

export async function countGuestConversations(): Promise<number> {
	return readHistory().conversations.length;
}

export async function saveGuestConversation(
	conversation: StoredConversation,
	messages: StoredMessage[] = []
): Promise<void> {
	const history = readHistory();
	const conversationIndex = history.conversations.findIndex(({ id }) => id === conversation.id);
	if (conversationIndex === -1) history.conversations.push(conversation);
	else history.conversations[conversationIndex] = conversation;

	const incomingIds = new Set(messages.map(({ id }) => id));
	history.messages = history.messages.filter(({ id }) => !incomingIds.has(id));
	history.messages.push(...messages);
	writeHistory(history);
}

export async function deleteGuestConversation(conversationId: string): Promise<void> {
	const history = readHistory();
	writeHistory({
		conversations: history.conversations.filter(({ id }) => id !== conversationId),
		messages: history.messages.filter((message) => message.conversationId !== conversationId)
	});
}

export async function readGuestImport(): Promise<ConversationImport> {
	return readHistory();
}

export async function clearGuestHistory(): Promise<void> {
	getStorage().removeItem(storageKey);
}

export async function resetGuestStoreForTests(): Promise<void> {
	getStorage().removeItem(storageKey);
}
