import { afterEach, describe, expect, it } from 'vitest';
import {
	deleteGuestConversation,
	listGuestMessages,
	listGuestConversations,
	readGuestImport,
	resetGuestStoreForTests,
	saveGuestConversation
} from './guest-store';

const conversation = {
	id: '018f47a2-2d8e-7a15-8f7e-0123456789ab',
	title: 'Pantry dinner',
	createdAt: '2026-07-21T12:00:00.000Z',
	updatedAt: '2026-07-21T12:01:00.000Z',
	archivedAt: null
};

afterEach(() => resetGuestStoreForTests());

describe('guest history', () => {
	it('stores a conversation and its messages transactionally', async () => {
		await saveGuestConversation(conversation, [{
			id: '018f47a2-2d8e-7a15-8f7e-1123456789ab',
			conversationId: conversation.id,
			role: 'user',
			content: 'Use my pantry ingredients.',
			position: 0,
			createdAt: conversation.createdAt
		}]);

		expect(await listGuestConversations()).toHaveLength(1);
		expect(await listGuestMessages(conversation.id)).toHaveLength(1);
		expect((await readGuestImport()).messages).toHaveLength(1);
	});

	it('keeps guest history in sessionStorage', async () => {
		await saveGuestConversation(conversation);

		expect(sessionStorage.getItem('recipe-chat-bot-guest-history')).toContain(conversation.id);
	});

	it('deletes messages with their guest conversation', async () => {
		await saveGuestConversation(conversation, [{
			id: '018f47a2-2d8e-7a15-8f7e-1123456789ab',
			conversationId: conversation.id,
			role: 'user',
			content: 'Dinner ideas?',
			position: 0,
			createdAt: conversation.createdAt
		}]);

		await deleteGuestConversation(conversation.id);
		expect(await readGuestImport()).toEqual({ conversations: [], messages: [] });
	});
});
