import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecipeFacts, StoredRecipeCandidate } from '$lib/recipes/types';
import { _createRecipeSearchHandler } from './+server';

const conversationId = '018f47a2-2d8e-7a15-8f7e-0123456789ab';
const messageId = '018f47a2-2d8e-7a15-8f7e-1123456789ab';
const facts: RecipeFacts = {
	title: 'Pad Thai', yield: '4', prepTime: null, cookTime: 'PT20M', totalTime: 'PT30M',
	cuisines: ['Thai'], categories: [], ingredients: ['200 g noodles'], instructions: ['Cook noodles.']
};
const candidate: StoredRecipeCandidate = {
	id: '018f47a2-2d8e-7a15-8f7e-2123456789ab', title: 'Pad Thai', domain: 'recipes.example',
	url: 'https://recipes.example/pad-thai', snippet: 'A noodle recipe.', approved: true,
	sourceKey: 'source-key', facts
};

function request(content: string, origin = 'https://recipe.example') {
	return new Request('https://recipe.example/api/recipes/search', {
		method: 'POST', headers: { 'content-type': 'application/json', origin },
		body: JSON.stringify({ conversationId, message: { id: messageId, content } })
	});
}

describe('recipe source search endpoint', () => {
	const dependencies = {
		getConfig: vi.fn(() => ({ enabled: true, sharedLimit: '50' })),
		getDatabase: vi.fn(() => ({}) as never),
		findCached: vi.fn(async () => [] as StoredRecipeCandidate[]),
		reserve: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
		discover: vi.fn(async () => [candidate]),
		persist: vi.fn(async () => ({
			searchId: crypto.randomUUID(),
			assistantMessageId: crypto.randomUUID(),
			assistantContent: 'Choose a source.'
		}))
	};
	const handler = _createRecipeSearchHandler(dependencies);

	beforeEach(() => vi.clearAllMocks());

	it('bypasses discovery for narrow questions', async () => {
		const sourceRequest = request('Can I replace fish sauce?');
		const response = await handler({
			request: sourceRequest,
			url: new URL(sourceRequest.url),
			locals: { auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) }
		} as never);

		expect(await response.json()).toEqual({ kind: 'generate' });
		expect(dependencies.reserve).not.toHaveBeenCalled();
	});

	it('searches with a privacy-reduced query and omits facts from the client response', async () => {
		const sourceRequest = request('Recipe for pad thai without peanuts because I am allergic');
		const response = await handler({
			request: sourceRequest,
			url: new URL(sourceRequest.url),
			locals: { auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) }
		} as never);

		expect(response.status).toBe(200);
		expect(dependencies.discover).toHaveBeenCalledWith(expect.anything(), {
			queryText: 'pad thai', queryKey: 'pad-thai', cachedCandidates: []
		});
		const body = await response.json();
		expect(body.kind).toBe('choose');
		expect(body.candidates[0]).not.toHaveProperty('facts');
		expect(body.candidates[0]).not.toHaveProperty('sourceKey');
		expect(dependencies.persist).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
			userId: 'user-1', content: 'Recipe for pad thai without peanuts because I am allergic'
		}));
	});

	it('serves complete cache hits without consuming live-search quota', async () => {
		dependencies.findCached.mockResolvedValueOnce([candidate, {
			...candidate,
			id: crypto.randomUUID(),
			url: 'https://recipes.example/pad-thai-2'
		}, {
			...candidate,
			id: crypto.randomUUID(),
			url: 'https://recipes.example/pad-thai-3'
		}]);
		const sourceRequest = request('Recipe for pad thai');
		const response = await handler({
			request: sourceRequest,
			url: new URL(sourceRequest.url),
			locals: { auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) }
		} as never);

		expect(response.status).toBe(200);
		expect(dependencies.reserve).not.toHaveBeenCalled();
		expect(dependencies.discover).not.toHaveBeenCalled();
	});

	it('rejects cross-origin requests before discovery', async () => {
		const sourceRequest = request('Recipe for pad thai', 'https://attacker.example');
		await expect(handler({
			request: sourceRequest,
			url: new URL(sourceRequest.url),
			locals: { auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) }
		} as never)).rejects.toMatchObject({ status: 403 });
		expect(dependencies.discover).not.toHaveBeenCalled();
	});
});
