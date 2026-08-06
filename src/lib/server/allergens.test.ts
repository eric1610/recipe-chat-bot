import { describe, expect, it } from 'vitest';
import { extractDeclaredAllergies, normalizeAllergenName } from './allergens';

describe('chat allergy declarations', () => {
	it('extracts explicit first-person allergy lists', () => {
		expect(
			extractDeclaredAllergies(
				"I'm allergic to peanuts and shellfish. Also, I have an allergy to sesame, mustard & soy."
			)
		).toEqual(['peanuts', 'shellfish', 'sesame', 'mustard', 'soy']);
	});

	it('keeps the allergy value separate from following context', () => {
		expect(extractDeclaredAllergies('I am allergic to milk but eggs are fine.')).toEqual(['milk']);
		expect(extractDeclaredAllergies("I'm allergic to peanuts and I need dinner ideas.")).toEqual([
			'peanuts'
		]);
		expect(extractDeclaredAllergies("I'm allergic to peanuts, can you suggest dinner?")).toEqual([
			'peanuts'
		]);
	});

	it('does not persist negated, hypothetical, or third-person statements', () => {
		expect(extractDeclaredAllergies('I am not allergic to peanuts.')).toEqual([]);
		expect(extractDeclaredAllergies('If I am allergic to soy, what happens?')).toEqual([]);
		expect(extractDeclaredAllergies('My friend is allergic to shellfish.')).toEqual([]);
	});

	it('normalizes names for account-scoped uniqueness', () => {
		expect(normalizeAllergenName('  PEANUTS\u0000  ')).toBe('peanuts');
	});
});
