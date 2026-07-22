import type {
	ConversationImport,
	MessageRole,
	StoredConversation,
	StoredMessage
} from '$lib/chat/types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// All browser-imported history is user-controlled. Assistant and system roles are server-owned.
const roles = new Set<MessageRole>(['user']);

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
	return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function parseConversation(value: unknown): StoredConversation {
	if (!isObject(value)) throw new Error('Each conversation must be an object.');
	if (typeof value.id !== 'string' || !uuidPattern.test(value.id)) throw new Error('Conversation IDs must be UUIDs.');
	if (typeof value.title !== 'string' || value.title.trim().length < 1 || value.title.length > 160) {
		throw new Error('Conversation titles must contain 1–160 characters.');
	}
	if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) throw new Error('Conversation timestamps are invalid.');
	if (value.archivedAt !== null && !isIsoDate(value.archivedAt)) throw new Error('Archive timestamps are invalid.');

	return {
		id: value.id,
		title: value.title.trim(),
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
		archivedAt: value.archivedAt
	};
}

function parseMessage(value: unknown): StoredMessage {
	if (!isObject(value)) throw new Error('Each message must be an object.');
	if (typeof value.id !== 'string' || !uuidPattern.test(value.id)) throw new Error('Message IDs must be UUIDs.');
	if (typeof value.conversationId !== 'string' || !uuidPattern.test(value.conversationId)) {
		throw new Error('Message conversation IDs must be UUIDs.');
	}
	if (typeof value.role !== 'string' || !roles.has(value.role as MessageRole)) throw new Error('Message roles are invalid.');
	if (typeof value.content !== 'string' || value.content.length > 8_000) throw new Error('Messages may contain at most 8,000 characters.');
	if (!Number.isInteger(value.position) || (value.position as number) < 0) throw new Error('Message positions must be non-negative integers.');
	if (!isIsoDate(value.createdAt)) throw new Error('Message timestamps are invalid.');

	return {
		id: value.id,
		conversationId: value.conversationId,
		role: value.role as MessageRole,
		content: value.content,
		position: value.position as number,
		createdAt: value.createdAt
	};
}

export function parseConversationImport(value: unknown): ConversationImport {
	if (!isObject(value) || !Array.isArray(value.conversations) || !Array.isArray(value.messages)) {
		throw new Error('The import payload must contain conversations and messages.');
	}
	if (value.conversations.length > 20) throw new Error('A single import may contain at most 20 conversations.');
	if (value.messages.length > 500) throw new Error('A single import may contain at most 500 messages.');

	const conversations = value.conversations.map(parseConversation);
	const conversationIds = new Set(conversations.map((conversation) => conversation.id));
	if (conversationIds.size !== conversations.length) throw new Error('Conversation IDs must be unique.');

	const messages = value.messages.map(parseMessage);
	const messageIds = new Set(messages.map((message) => message.id));
	if (messageIds.size !== messages.length) throw new Error('Message IDs must be unique.');
	if (messages.some((message) => !conversationIds.has(message.conversationId))) {
		throw new Error('Every message must belong to an imported conversation.');
	}

	return { conversations, messages };
}
