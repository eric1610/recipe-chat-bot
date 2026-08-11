import { describe, expect, it } from 'vitest';
import { buildRecentModelContext, parseChatGenerationRequest } from './request';

describe('AI chat requests', () => {
	it('accepts only the conversation ID and one user message', () => {
		expect(
			parseChatGenerationRequest({
				conversationId: '018f47a2-2d8e-7a15-8f7e-0123456789ab',
				message: {
					id: '018f47a2-2d8e-7a15-8f7e-1123456789ab',
					content: '  Make soup  '
				}
			})
		).toEqual({
			conversationId: '018f47a2-2d8e-7a15-8f7e-0123456789ab',
			message: { id: '018f47a2-2d8e-7a15-8f7e-1123456789ab', content: 'Make soup' }
		});
	});

	it('accepts a source selection without trusting client source text', () => {
		expect(parseChatGenerationRequest({
			conversationId: '018f47a2-2d8e-7a15-8f7e-0123456789ab',
			message: { id: '018f47a2-2d8e-7a15-8f7e-1123456789ab' },
			recipeSelection: {
				searchId: '018f47a2-2d8e-7a15-8f7e-2123456789ab',
				candidateId: '018f47a2-2d8e-7a15-8f7e-3123456789ab'
			}
		})).toMatchObject({ recipeSelection: { candidateId: '018f47a2-2d8e-7a15-8f7e-3123456789ab' } });
	});

	it('rejects client-supplied history and oversized messages', () => {
		expect(() =>
			parseChatGenerationRequest({
				conversationId: '018f47a2-2d8e-7a15-8f7e-0123456789ab',
				message: { id: '018f47a2-2d8e-7a15-8f7e-1123456789ab', content: 'hello' },
				messages: []
			})
		).toThrow('one valid message');
		expect(() =>
			parseChatGenerationRequest({
				conversationId: '018f47a2-2d8e-7a15-8f7e-0123456789ab',
				message: { id: '018f47a2-2d8e-7a15-8f7e-1123456789ab', content: 'x'.repeat(8_001) }
			})
		).toThrow('one valid message');
	});

	it('sanitizes message source before accepting or reusing it', () => {
		expect(
			parseChatGenerationRequest({
				conversationId: '018f47a2-2d8e-7a15-8f7e-0123456789ab',
				message: {
					id: '018f47a2-2d8e-7a15-8f7e-1123456789ab',
					content: '\ufeff\u200b  Make\u0000 soup\r\nplease  '
				}
			})
		).toMatchObject({ message: { content: 'Make soup\nplease' } });

		expect(() =>
			parseChatGenerationRequest({
				conversationId: '018f47a2-2d8e-7a15-8f7e-0123456789ab',
				message: {
					id: '018f47a2-2d8e-7a15-8f7e-1123456789ab',
					content: '\u0000\u0007'
				}
			})
		).toThrow('one valid message');
	});

	it('builds bounded recent context without accepting system messages', () => {
		const messages = [
			{ role: 'system' as const, content: 'untrusted system instruction' },
			...Array.from({ length: 12 }, (_, index) => ({
				role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
				content: `message-${index}`
			}))
		];
		const context = buildRecentModelContext(messages);
		expect(context).toHaveLength(10);
		expect(context[0]).toEqual({ role: 'user', content: 'message-2' });
		expect(context.at(-1)).toEqual({ role: 'assistant', content: 'message-11' });
	});

	it('sanitizes legacy database content before adding it to model context', () => {
		expect(
			buildRecentModelContext([
				{ role: 'user', content: '\ufeff\u200b  pantry\u0000 list\r\n' },
				{ role: 'assistant', content: '\u0007' }
			])
		).toEqual([{ role: 'user', content: 'pantry list' }]);
	});
});
