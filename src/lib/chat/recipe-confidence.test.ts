import { describe, expect, it } from 'vitest';
import { parseRecipeConfidenceReport, recipeConfidenceLevel } from './recipe-confidence';

describe('recipe confidence reports', () => {
	it.each([
		[100, 'high'],
		[80, 'high'],
		[79, 'medium'],
		[50, 'medium'],
		[49, 'low'],
		[0, 'low']
	] as const)('maps %i%% to the %s theme', (percentage, level) => {
		expect(recipeConfidenceLevel(percentage)).toBe(level);
	});

	it('rejects invalid percentages and mismatched labels', () => {
		expect(recipeConfidenceLevel(-1)).toBeNull();
		expect(recipeConfidenceLevel(101)).toBeNull();
		expect(recipeConfidenceLevel(72.5)).toBeNull();
		expect(parseRecipeConfidenceReport('**Ingredient accuracy estimate: High (72%)**')).toBeNull();
	});

	it('recognizes ingredient and instruction report headings', () => {
		expect(
			parseRecipeConfidenceReport(
				'**Ingredient accuracy estimate: High (85%)**\n\nAI best-judgment estimate.'
			)
		).toEqual({ level: 'high', percentage: 85 });
		expect(
			parseRecipeConfidenceReport(
				'**Instruction accuracy estimate: Medium (65%)**\n\nAI best-judgment estimate.'
			)
		).toEqual({ level: 'medium', percentage: 65 });
	});
});
