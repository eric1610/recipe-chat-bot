import { describe, expect, it } from 'vitest';
import { parseConversationImport } from './import';

const conversationId = '018f47a2-2d8e-7a15-8f7e-0123456789ab';
const messageId = '018f47a2-2d8e-7a15-8f7e-1123456789ab';

describe('parseConversationImport', () => {
	it('accepts a valid conversation and message payload', () => {
		const result = parseConversationImport({
			conversations: [{
				id: conversationId,
				title: 'Weeknight pasta',
				createdAt: '2026-07-21T12:00:00.000Z',
				updatedAt: '2026-07-21T12:01:00.000Z',
				archivedAt: null
			}],
			messages: [{
				id: messageId,
				conversationId,
				role: 'user',
				content: 'What can I make?',
				position: 0,
				createdAt: '2026-07-21T12:00:00.000Z'
			}]
		});

		expect(result.conversations[0].title).toBe('Weeknight pasta');
		expect(result.messages[0].conversationId).toBe(conversationId);
	});

	it('rejects messages that do not belong to the imported conversations', () => {
		expect(() => parseConversationImport({
			conversations: [{
				id: conversationId,
				title: 'Soup',
				createdAt: '2026-07-21T12:00:00.000Z',
				updatedAt: '2026-07-21T12:00:00.000Z',
				archivedAt: null
			}],
			messages: [{
				id: messageId,
				conversationId: '018f47a2-2d8e-7a15-8f7e-2123456789ab',
				role: 'assistant',
				content: 'Try soup.',
				position: 1,
				createdAt: '2026-07-21T12:00:01.000Z'
			}]
		})).toThrow('Every message must belong');
	});
});
