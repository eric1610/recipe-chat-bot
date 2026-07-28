import { beforeEach, describe, expect, it, vi } from 'vitest';

const chatPage = vi.hoisted(() => ({
	deleteChatConversation: vi.fn(),
	loadChatData: vi.fn()
}));

vi.mock('$lib/server/chat/page', () => chatPage);

import { load } from './[conversationId]/+page.server';

const conversationId = '018f47a2-2d8e-7a15-8f7e-0123456789ab';

function loadEvent(userId: string | null, id = conversationId) {
	return {
		locals: {
			auth: vi.fn().mockResolvedValue(userId ? { user: { id: userId } } : null)
		},
		params: { conversationId: id },
		url: new URL(`https://recipe.example/chat/${id}`)
	};
}

describe('conversation page loading', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		chatPage.loadChatData.mockResolvedValue({
			aiUsage: {},
			conversations: [],
			currentConversation: { id: conversationId },
			messages: []
		});
	});

	it('preserves a canonical conversation URL through sign-in', async () => {
		await expect(load(loadEvent(null) as never)).rejects.toMatchObject({
			status: 303,
			location: `/signin?redirectTo=${encodeURIComponent(`/chat/${conversationId}`)}`
		});
		expect(chatPage.loadChatData).not.toHaveBeenCalled();
	});

	it('returns the same 404 for malformed conversation identifiers', async () => {
		await expect(load(loadEvent('user-1', 'not-a-conversation') as never)).rejects.toMatchObject({
			status: 404,
			body: { message: 'Conversation not found.' }
		});
		expect(chatPage.loadChatData).not.toHaveBeenCalled();
	});

	it('loads a valid conversation through the account-scoped loader', async () => {
		const result = await load(loadEvent('user-1') as never);
		expect(chatPage.loadChatData).toHaveBeenCalledWith('user-1', conversationId);
		expect(result).toMatchObject({
			session: { user: { id: 'user-1' } },
			currentConversation: { id: conversationId },
			messages: []
		});
	});
});
