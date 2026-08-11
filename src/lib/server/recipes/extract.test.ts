import { describe, expect, it } from 'vitest';
import { extractRecipeFacts } from './extract';

describe('Schema.org recipe extraction', () => {
	it('normalizes Recipe JSON-LD from an @graph and nested sections', () => {
		const html = `<html><script type="application/ld+json">${JSON.stringify({
			'@graph': [{
				'@type': ['Thing', 'Recipe'],
				name: 'Tomato Pasta',
				recipeYield: ['2 servings'],
				totalTime: 'PT25M',
				recipeCuisine: ['Italian'],
				recipeIngredient: ['200 g pasta', '2 tomatoes'],
				recipeInstructions: [{
					'@type': 'HowToSection',
					itemListElement: [{ '@type': 'HowToStep', text: 'Boil the pasta.' }, { '@type': 'HowToStep', text: 'Add tomatoes.' }]
				}]
			}]
		})}</script></html>`;

		expect(extractRecipeFacts(html)).toEqual({
			title: 'Tomato Pasta', yield: '2 servings', prepTime: null, cookTime: null,
			totalTime: 'PT25M', cuisines: ['Italian'], categories: [],
			ingredients: ['200 g pasta', '2 tomatoes'],
			instructions: ['Boil the pasta.', 'Add tomatoes.']
		});
	});

	it('skips malformed blocks and requires ingredients and instructions', () => {
		const html = `<script type="application/ld+json">{bad}</script>
		<script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Incomplete' })}</script>`;
		expect(extractRecipeFacts(html)).toBeNull();
	});
});
