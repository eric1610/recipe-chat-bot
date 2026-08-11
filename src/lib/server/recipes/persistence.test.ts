import { describe, expect, it } from 'vitest';
import type { RecipeFacts } from '$lib/recipes/types';
import { nextRecipeCacheState } from './persistence';

const facts: RecipeFacts = {
	title: 'Soup', yield: '4', prepTime: null, cookTime: 'PT20M', totalTime: 'PT30M',
	cuisines: [], categories: [], ingredients: ['1 onion'], instructions: ['Cook onion.']
};

describe('recipe cache promotion', () => {
	it('stores facts on the third selection in thirty days', () => {
		const now = new Date('2026-08-10T12:00:00Z');
		const next = nextRecipeCacheState({
			queryKeys: ['soup'], selectionCount: 2,
			selectionWindowStart: new Date('2026-08-01T00:00:00Z'),
			normalizedFacts: null, cachedAt: null, refreshAfter: null
		}, { queryKey: 'onion-soup', facts, now });

		expect(next.selectionCount).toBe(3);
		expect(next.normalizedFacts).toEqual(facts);
		expect(next.queryKeys).toEqual(['soup', 'onion-soup']);
		expect(next.refreshAfter).toEqual(new Date('2026-09-09T12:00:00Z'));
	});

	it('resets stale demand but refreshes an already promoted recipe', () => {
		const now = new Date('2026-08-10T12:00:00Z');
		const next = nextRecipeCacheState({
			queryKeys: ['soup'], selectionCount: 5,
			selectionWindowStart: new Date('2026-06-01T00:00:00Z'),
			normalizedFacts: facts, cachedAt: new Date('2026-06-01T00:00:00Z'),
			refreshAfter: new Date('2026-07-01T00:00:00Z')
		}, { queryKey: 'soup', facts: { ...facts, title: 'Fresh Soup' }, now });

		expect(next.selectionCount).toBe(1);
		expect(next.normalizedFacts?.title).toBe('Fresh Soup');
		expect(next.cachedAt).toEqual(now);
	});
});
