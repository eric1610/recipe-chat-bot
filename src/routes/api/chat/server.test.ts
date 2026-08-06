import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	consumeRateLimit: vi.fn(),
	createOpenRouter: vi.fn(),
	getRecentConversationContext: vi.fn(),
	loadUserPreferences: vi.fn(),
	markAiAttemptFailed: vi.fn(),
	persistUserMessageForGeneration: vi.fn(),
	persistDeclaredAllergies: vi.fn(),
	reserveAiQuota: vi.fn(),
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
	getRecentConversationContext: mocks.getRecentConversationContext,
	persistCompletedAssistant: vi.fn(),
	persistUserMessageForGeneration: mocks.persistUserMessageForGeneration
}));
vi.mock('$lib/server/ai/preferences', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/ai/preferences')>()),
	loadUserPreferences: mocks.loadUserPreferences
}));
vi.mock('$lib/server/ai/quota', () => ({
	getUtcQuotaWindow: vi.fn(),
	isQuotaExempt: () => false,
	markAiAttemptFailed: mocks.markAiAttemptFailed,
	markAiAttemptStarted: vi.fn(),
	markOpenRouterLimited: vi.fn(),
	OPENROUTER_MODEL: 'openrouter/free',
	reserveAiQuota: mocks.reserveAiQuota
}));
vi.mock('$lib/server/security/limits', () => ({ consumeRateLimit: mocks.consumeRateLimit }));

const database = {
	select: vi.fn(() => ({
		from: () => ({
			where: () => ({ limit: async () => [{ email: 'cook@example.test' }] })
		})
	}))
};

import { POST } from './+server';

const conversationId = '018f47a2-2d8e-7a15-8f7e-0123456789ab';
const messageId = '018f47a2-2d8e-7a15-8f7e-1123456789ab';

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
				instructions: expect.stringMatching(
					/## Ingredients[\s\S]+Ingredient accuracy estimate:[\s\S]+## Instructions[\s\S]+Instruction accuracy estimate:[\s\S]+"allergies":\["peanuts"\]/
				),
				messages: [{ role: 'user', content: 'Make dinner' }]
			})
		);
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
});
