import { describe, expect, it } from 'vitest';
import { annotateRecipeAllergens } from './allergens';

describe('recipe allergen annotation', () => {
	it('bolds and warns matching ingredients only inside the ingredients section', () => {
		const result = annotateRecipeAllergens(
			'# Peanut noodles\n\n## Ingredients\n- 2 tbsp peanut butter\n- 1 tsp oil\n\n## Instructions\n1. Stir in peanut butter.',
			['peanut', 'peanut butter']
		);

		expect(result).toContain('- ⚠️ Possible allergen: **2 tbsp peanut butter**');
		expect(result).toContain('- 1 tsp oil');
		expect(result).toContain('1. Stir in peanut butter.');
		expect(result.match(/⚠️/g)).toHaveLength(1);
	});

	it('matches complete terms without flagging partial words', () => {
		const result = annotateRecipeAllergens(
			'## Ingredients\n- 2 eggs\n- 1 eggplant\n- 1 cup soy milk',
			['egg', 'eggs', 'milk']
		);

		expect(result).toContain('⚠️ Possible allergen: **2 eggs**');
		expect(result).toContain('- 1 eggplant');
		expect(result).toContain('⚠️ Possible allergen: **1 cup soy milk**');
	});

	it('does not duplicate an existing warning or alter Markdown without terms', () => {
		const warned = '## Ingredients\n- ⚠️ Possible allergen: **1 cup milk**';
		expect(annotateRecipeAllergens(warned, ['milk'])).toBe(warned);
		expect(annotateRecipeAllergens(warned, [])).toBe(warned);
	});
});
