import { describe, expect, it } from 'vitest';
import { parsePreferences } from './preferences';

function preferences(entries: Record<string, string>): FormData {
	const formData = new FormData();
	for (const [name, value] of Object.entries(entries)) formData.set(name, value);
	return formData;
}

describe('preference input validation', () => {
	it('normalizes bounded text and removes storage-hostile control characters', () => {
		expect(
			parsePreferences(
				preferences({
					diets: ' vegetarian, vegetarian, low\u0000 sodium ',
					allergies: 'peanuts',
					dislikedIngredients: 'cilantro',
					preferredCuisines: 'Korean',
					cookingSkill: 'beginner',
					householdSize: '2',
					notes: '  Weeknights\u0000 only  '
				})
			)
		).toEqual({
			diets: ['vegetarian', 'low sodium'],
			allergies: ['peanuts'],
			dislikedIngredients: ['cilantro'],
			preferredCuisines: ['Korean'],
			cookingSkill: 'beginner',
			householdSize: 2,
			notes: 'Weeknights only'
		});
	});

	it('rejects unknown, duplicate, file, and invalid enum fields', () => {
		const unknown = preferences({ unexpected: '<script>alert(1)</script>' });
		expect(() => parsePreferences(unknown)).toThrow('unknown field');

		const duplicate = preferences({ diets: 'vegetarian' });
		duplicate.append('diets', 'vegan');
		expect(() => parsePreferences(duplicate)).toThrow('only once');

		const file = preferences({});
		file.set('notes', new File(['payload'], 'payload.html', { type: 'text/html' }));
		expect(() => parsePreferences(file)).toThrow('must contain text');

		expect(() => parsePreferences(preferences({ cookingSkill: 'wizard' }))).toThrow(
			'Cooking skill'
		);
	});

	it('rejects oversized lists, notes, items, counts, and household values', () => {
		expect(() => parsePreferences(preferences({ diets: 'x'.repeat(4_001) }))).toThrow(
			'at most 4,000'
		);
		expect(() => parsePreferences(preferences({ diets: 'x'.repeat(101) }))).toThrow(
			'at most 100'
		);
		expect(() =>
			parsePreferences(preferences({ diets: Array.from({ length: 31 }, (_, index) => `d${index}`).join(',') }))
		).toThrow('at most 30');
		expect(() => parsePreferences(preferences({ notes: 'x'.repeat(2_001) }))).toThrow(
			'at most 2,000'
		);
		expect(() => parsePreferences(preferences({ householdSize: '31' }))).toThrow(
			'between 1 and 30'
		);
	});

	it('keeps HTML-looking text as inert data for escaped rendering and prompt encoding', () => {
		const result = parsePreferences(
			preferences({ notes: '<img src=x onerror=alert(1)>', allergies: '<script>food</script>' })
		);
		expect(result.notes).toBe('<img src=x onerror=alert(1)>');
		expect(result.allergies).toEqual(['<script>food</script>']);
	});
});
