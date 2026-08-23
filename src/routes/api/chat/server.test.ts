import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	consumeRateLimit: vi.fn(),
	createOpenRouter: vi.fn(),
	getRecentConversationContext: vi.fn(),
	loadRetryableUserMessage: vi.fn(),
	getUtcQuotaWindow: vi.fn(),
	loadUserPreferences: vi.fn(),
	markAiAttemptFailed: vi.fn(),
	markAiAttemptStarted: vi.fn(),
	markOpenRouterLimited: vi.fn(),
	persistCompletedAssistant: vi.fn(),
	persistUserMessageForGeneration: vi.fn(),
	persistDeclaredAllergies: vi.fn(),
	reserveAiQuota: vi.fn(),
	resolveRecipeSelection: vi.fn(),
	resolveRetryRecipeSelection: vi.fn(),
	streamText: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({
	env: { OPENROUTER_API_KEY: 'test-openrouter-key', AI_DAILY_CAP_EXEMPT_EMAILS: '' }
}));
vi.mock('@openrouter/ai-sdk-provider', () => ({ createOpenRouter: mocks.createOpenRouter }));
vi.mock('ai', async (importOriginal) => ({
	...(await importOriginal<typeof import('ai')>()),
	streamText: mocks.streamText
}));
vi.mock('$lib/server/db', () => ({ getDatabase: () => database }));
vi.mock('$lib/server/allergens', () => ({
	persistDeclaredAllergies: mocks.persistDeclaredAllergies
}));
vi.mock('$lib/server/ai/persistence', () => ({
	ConversationAccessError: class ConversationAccessError extends Error {},
	ConversationRetryError: class ConversationRetryError extends Error {},
	getRecentConversationContext: mocks.getRecentConversationContext,
	loadRetryableUserMessage: mocks.loadRetryableUserMessage,
	persistCompletedAssistant: mocks.persistCompletedAssistant,
	persistUserMessageForGeneration: mocks.persistUserMessageForGeneration
}));
vi.mock('$lib/server/ai/preferences', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/ai/preferences')>()),
	loadUserPreferences: mocks.loadUserPreferences
}));
vi.mock('$lib/server/ai/quota', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/ai/quota')>()),
	getUtcQuotaWindow: mocks.getUtcQuotaWindow,
	isQuotaExempt: () => false,
	markAiAttemptFailed: mocks.markAiAttemptFailed,
	markAiAttemptStarted: mocks.markAiAttemptStarted,
	markOpenRouterLimited: mocks.markOpenRouterLimited,
	OPENROUTER_MODEL: 'openrouter/free',
	reserveAiQuota: mocks.reserveAiQuota
}));
vi.mock('$lib/server/security/limits', () => ({ consumeRateLimit: mocks.consumeRateLimit }));
vi.mock('$lib/server/recipes/persistence', () => ({
	RecipeSearchAccessError: class RecipeSearchAccessError extends Error {},
	RecipeSearchExpiredError: class RecipeSearchExpiredError extends Error {},
	resolveRecipeSelection: mocks.resolveRecipeSelection,
	resolveRetryRecipeSelection: mocks.resolveRetryRecipeSelection
}));

const database = {
	select: vi.fn(() => ({
		from: () => ({
			where: () => ({ limit: async () => [{ email: 'cook@example.test' }] })
		})
	}))
};

import { POST } from './+server';
import { APICallError } from 'ai';
import { AiRetryNotAllowedError } from '$lib/server/ai/quota';

const conversationId = '018f47a2-2d8e-7a15-8f7e-0123456789ab';
const messageId = '018f47a2-2d8e-7a15-8f7e-1123456789ab';

function chatRequest() {
	return new Request('https://recipe.example/api/chat', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin: 'https://recipe.example'
		},
		body: JSON.stringify({
			conversationId,
			message: { id: messageId, content: 'Make dinner' }
		})
	});
}

function retryRequest() {
	return new Request('https://recipe.example/api/chat', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin: 'https://recipe.example'
		},
		body: JSON.stringify({ conversationId, message: { id: messageId }, retry: true })
	});
}

function post(request: Request) {
	return POST({
		request,
		locals: { auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) },
		url: new URL(request.url)
	} as never);
}

describe('preference-aware chat generation', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.consumeRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
		mocks.createOpenRouter.mockReturnValue(() => ({ modelId: 'openrouter/free' }));
		mocks.getRecentConversationContext.mockResolvedValue([{ role: 'user', content: 'Make dinner' }]);
		mocks.loadUserPreferences.mockResolvedValue({
			diets: ['vegetarian'],
			allergies: ['peanuts'],
			dislikedIngredients: [],
			preferredCuisines: ['Thai'],
			cookingSkill: 'beginner',
			householdSize: 2,
			notes: ''
		});
		mocks.loadRetryableUserMessage.mockResolvedValue({ content: 'Make dinner', position: 0 });
		mocks.resolveRetryRecipeSelection.mockResolvedValue(null);
		mocks.getUtcQuotaWindow.mockReturnValue({
			start: new Date('2030-05-02T00:00:00.000Z'),
			end: new Date('2030-05-03T00:00:00.000Z')
		});
		mocks.markAiAttemptFailed.mockResolvedValue(undefined);
		mocks.markAiAttemptStarted.mockResolvedValue(undefined);
		mocks.markOpenRouterLimited.mockResolvedValue(undefined);
		mocks.persistCompletedAssistant.mockResolvedValue(undefined);
		mocks.reserveAiQuota.mockImplementation(async (db, _input, onReserved) => {
			await onReserved(db, '018f47a2-2d8e-7a15-8f7e-2123456789ab');
			return {
				allowed: true,
				attemptId: '018f47a2-2d8e-7a15-8f7e-2123456789ab',
				retryAfter: 0,
				usage: {}
			};
		});
		mocks.streamText.mockReturnValue({
			toUIMessageStreamResponse: () => new Response('stream', { status: 200 })
		});
	});

	it('loads only the session user profile and sends it as server-owned instructions', async () => {
		const request = new Request('https://recipe.example/api/chat', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				origin: 'https://recipe.example'
			},
			body: JSON.stringify({
				conversationId,
				message: { id: messageId, content: 'Make dinner' }
			})
		});

		const response = await POST({
			request,
			locals: { auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) },
			url: new URL(request.url)
		} as never);

		expect(response.status).toBe(200);
		expect(mocks.loadUserPreferences).toHaveBeenCalledWith(database, 'user-1');
		expect(mocks.streamText).toHaveBeenCalledWith(
			expect.objectContaining({
				instructions: expect.stringContaining('Saved guidance level: Beginner')
			})
		);
		expect(mocks.streamText).toHaveBeenCalledWith(
			expect.objectContaining({
				instructions: expect.stringMatching(
					/## Ingredients[\s\S]+Ingredient accuracy estimate:[\s\S]+## Instructions[\s\S]+Instruction accuracy estimate:[\s\S]+"allergies":\["peanuts"\]/
				),
				messages: [{ role: 'user', content: 'Make dinner' }]
			})
		);
		expect(mocks.streamText.mock.calls[0][0].instructions).not.toContain('"cookingSkill"');
		expect(mocks.persistUserMessageForGeneration).toHaveBeenCalledWith(
			database,
			expect.objectContaining({ userId: 'user-1', content: 'Make dinner' })
		);
		expect(mocks.persistDeclaredAllergies).toHaveBeenCalledWith(
			database,
			'user-1',
			'Make dinner'
		);
		expect(await response.text()).not.toContain('peanuts');
	});

	it('preserves the cross-origin rejection before validation or provider access', async () => {
		const request = new Request('https://recipe.example/api/chat', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				origin: 'https://attacker.example'
			},
			body: JSON.stringify({
				conversationId,
				message: { id: messageId, content: 'Make dinner' }
			})
		});

		await expect(
			POST({
				request,
				locals: { auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) },
				url: new URL(request.url)
			} as never)
		).rejects.toMatchObject({ status: 403 });
		expect(mocks.reserveAiQuota).not.toHaveBeenCalled();
		expect(mocks.streamText).not.toHaveBeenCalled();
	});

	it('resolves a source selection server-side and adds bounded source instructions', async () => {
		mocks.resolveRecipeSelection.mockResolvedValue({
			content: 'Use “Tomato Pasta” from recipes.example.',
			instructions: '\n\nSelected recipe facts (JSON data): {"title":"Tomato Pasta"}'
		});
		mocks.getRecentConversationContext.mockResolvedValue([
			{ role: 'user', content: 'Use “Tomato Pasta” from recipes.example.' }
		]);
		const request = new Request('https://recipe.example/api/chat', {
			method: 'POST',
			headers: { 'content-type': 'application/json', origin: 'https://recipe.example' },
			body: JSON.stringify({
				conversationId,
				message: { id: messageId },
				recipeSelection: {
					searchId: '018f47a2-2d8e-7a15-8f7e-2123456789ab',
					candidateId: '018f47a2-2d8e-7a15-8f7e-3123456789ab'
				}
			})
		});

		const response = await POST({
			request,
			locals: { auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) },
			url: new URL(request.url)
		} as never);

		expect(response.status).toBe(200);
		expect(mocks.resolveRecipeSelection).toHaveBeenCalledWith(database, expect.objectContaining({
			userId: 'user-1', conversationId
		}));
		expect(mocks.persistUserMessageForGeneration).toHaveBeenCalledWith(database, expect.objectContaining({
			content: 'Use “Tomato Pasta” from recipes.example.'
		}));
		expect(mocks.persistDeclaredAllergies).not.toHaveBeenCalled();
		expect(mocks.streamText.mock.calls[0][0].instructions).toContain('Selected recipe facts');
	});

	it('retries a server-owned user message without persisting or extracting it again', async () => {
		const response = await post(retryRequest());

		expect(response.status).toBe(200);
		expect(mocks.reserveAiQuota).toHaveBeenCalledWith(
			database,
			expect.objectContaining({
				userId: 'user-1',
				conversationId,
				userMessageId: messageId,
				mode: 'retry'
			}),
			expect.any(Function)
		);
		expect(mocks.loadRetryableUserMessage).toHaveBeenCalledWith(
			database,
			expect.objectContaining({ userId: 'user-1', messageId })
		);
		expect(mocks.persistUserMessageForGeneration).not.toHaveBeenCalled();
		expect(mocks.persistDeclaredAllergies).not.toHaveBeenCalled();
		expect(mocks.streamText).toHaveBeenCalledWith(
			expect.objectContaining({ messages: [{ role: 'user', content: 'Make dinner' }] })
		);
	});

	it('restores server-owned recipe source instructions for a retry', async () => {
		mocks.resolveRetryRecipeSelection.mockResolvedValue({
			content: 'Make dinner',
			instructions: '\nSelected retry source facts'
		});

		await post(retryRequest());

		expect(mocks.streamText.mock.calls[0][0].instructions).toContain(
			'Selected retry source facts'
		);
	});

	it('rejects stale or mismatched retry state without provider access', async () => {
		mocks.resolveRetryRecipeSelection.mockResolvedValueOnce({
			content: 'A different stored selection',
			instructions: 'Must not be used'
		});
		await expect(post(retryRequest())).rejects.toMatchObject({
			status: 409,
			body: { message: 'This response can no longer be retried.' }
		});
		expect(mocks.streamText).not.toHaveBeenCalled();

		mocks.resolveRetryRecipeSelection.mockResolvedValue(null);
		mocks.reserveAiQuota.mockRejectedValueOnce(
			new AiRetryNotAllowedError('internal retry state')
		);
		await expect(post(retryRequest())).rejects.toMatchObject({
			status: 409,
			body: { message: 'This response can no longer be retried.' }
		});
		expect(mocks.streamText).not.toHaveBeenCalled();
	});

	it('persists a completed response before charging successful usage', async () => {
		const languageUsage = { inputTokens: 12, outputTokens: 34, totalTokens: 46 };
		mocks.streamText.mockImplementation((options) => {
			void options.onLanguageModelCallStart();
			options.onEnd({ text: 'A complete recipe.', usage: languageUsage });
			return {
				toUIMessageStreamResponse: async (responseOptions: { onEnd: (event: { isAborted: boolean }) => Promise<void> }) => {
					await responseOptions.onEnd({ isAborted: false });
					return new Response('stream', { status: 200 });
				}
			};
		});

		const response = await post(chatRequest());

		expect(response.status).toBe(200);
		expect(mocks.markAiAttemptStarted).toHaveBeenCalledOnce();
		expect(mocks.persistCompletedAssistant).toHaveBeenCalledWith(
			database,
			expect.objectContaining({
				attemptId: '018f47a2-2d8e-7a15-8f7e-2123456789ab',
				userId: 'user-1',
				conversationId,
				content: 'A complete recipe.',
				usage: languageUsage
			})
		);
		expect(mocks.markAiAttemptFailed).not.toHaveBeenCalled();
	});

	it('marks aborted and incomplete streams without persisting an assistant response', async () => {
		mocks.streamText.mockReturnValueOnce({
			toUIMessageStreamResponse: async (responseOptions: { onEnd: (event: { isAborted: boolean }) => Promise<void> }) => {
				await responseOptions.onEnd({ isAborted: true });
				return new Response('aborted', { status: 200 });
			}
		});
		await post(chatRequest());
		expect(mocks.markAiAttemptFailed).toHaveBeenCalledWith(
			database,
			'018f47a2-2d8e-7a15-8f7e-2123456789ab',
			'client_cancelled',
			'cancelled'
		);
		expect(mocks.persistCompletedAssistant).not.toHaveBeenCalled();

		vi.clearAllMocks();
		mocks.consumeRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
		mocks.createOpenRouter.mockReturnValue(() => ({ modelId: 'openrouter/free' }));
		mocks.getRecentConversationContext.mockResolvedValue([{ role: 'user', content: 'Make dinner' }]);
		mocks.loadUserPreferences.mockResolvedValue(null);
		mocks.reserveAiQuota.mockImplementation(async (db, _input, onReserved) => {
			await onReserved(db, '018f47a2-2d8e-7a15-8f7e-2123456789ab');
			return {
				allowed: true,
				attemptId: '018f47a2-2d8e-7a15-8f7e-2123456789ab',
				retryAfter: 0,
				usage: {}
			};
		});
		mocks.streamText.mockReturnValue({
			toUIMessageStreamResponse: async (responseOptions: { onEnd: (event: { isAborted: boolean }) => Promise<void> }) => {
				await responseOptions.onEnd({ isAborted: false });
				return new Response('incomplete', { status: 200 });
			}
		});

		await post(chatRequest());
		expect(mocks.markAiAttemptFailed).toHaveBeenCalledWith(
			database,
			'018f47a2-2d8e-7a15-8f7e-2123456789ab',
			'incomplete_stream'
		);
		expect(mocks.persistCompletedAssistant).not.toHaveBeenCalled();
	});

	it('does not charge completion when assistant persistence fails', async () => {
		mocks.persistCompletedAssistant.mockRejectedValue(new Error('database detail'));
		mocks.streamText.mockImplementation((options) => {
			options.onEnd({
				text: 'A response that cannot be saved.',
				usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
			});
			return {
				toUIMessageStreamResponse: async (responseOptions: { onEnd: (event: { isAborted: boolean }) => Promise<void> }) => {
					await responseOptions.onEnd({ isAborted: false });
					return new Response('stream', { status: 200 });
				}
			};
		});

		await expect(post(chatRequest())).rejects.toThrow('completed response could not be saved');
		expect(mocks.markAiAttemptFailed).toHaveBeenCalledWith(
			database,
			'018f47a2-2d8e-7a15-8f7e-2123456789ab',
			'assistant_persistence_failed'
		);
	});

	it('records provider failures and latches provider rate limits', async () => {
		mocks.streamText.mockImplementationOnce(() => {
			throw new Error('provider failed');
		});
		const failed = await post(chatRequest());
		expect(failed.status).toBe(503);
		expect(mocks.markAiAttemptFailed).toHaveBeenCalledWith(
			database,
			'018f47a2-2d8e-7a15-8f7e-2123456789ab',
			'generation_failed'
		);

		vi.clearAllMocks();
		mocks.consumeRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
		mocks.createOpenRouter.mockReturnValue(() => ({ modelId: 'openrouter/free' }));
		mocks.getRecentConversationContext.mockResolvedValue([{ role: 'user', content: 'Make dinner' }]);
		mocks.loadUserPreferences.mockResolvedValue(null);
		mocks.getUtcQuotaWindow.mockReturnValue({
			start: new Date('2030-05-02T00:00:00.000Z'),
			end: new Date('2030-05-03T00:00:00.000Z')
		});
		mocks.reserveAiQuota.mockImplementation(async (db, _input, onReserved) => {
			await onReserved(db, '018f47a2-2d8e-7a15-8f7e-2123456789ab');
			return {
				allowed: true,
				attemptId: '018f47a2-2d8e-7a15-8f7e-2123456789ab',
				retryAfter: 0,
				usage: {}
			};
		});
		const providerLimit = new APICallError({
			message: 'provider limited',
			url: 'https://openrouter.ai/api/v1/chat/completions',
			requestBodyValues: {},
			statusCode: 429,
			responseHeaders: { 'retry-after': '60' }
		});
		mocks.streamText.mockImplementationOnce(() => {
			throw providerLimit;
		});
		const limited = await post(chatRequest());
		expect(limited.status).toBe(429);
		expect(mocks.markOpenRouterLimited).toHaveBeenCalledOnce();
		expect(mocks.markAiAttemptFailed).not.toHaveBeenCalled();
	});
});
