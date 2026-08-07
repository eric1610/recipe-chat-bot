import { describe, expect, it } from 'vitest';
import { renderSafeMarkdown } from '$lib/chat/markdown';
import { recipeInstructions } from './recipe-instructions';

const workingRecipeExamples = [
	{
		name: 'tomato pasta with complete quantities and technique',
		markdown: `# Tomato Pasta
**Servings:** 2
**Estimated time:** 25 minutes
**Guidance level:** Intermediate

## Ingredients
- 200 g dried pasta
- 400 g canned tomatoes
- 1 tbsp olive oil
- Salt to taste

> **Ingredient accuracy estimate: High (90%)**
>
> AI best-judgment estimate based on common cooking patterns; not independently tested or verified. The pasta-to-sauce ratio is typical for two servings.

## Instructions
1. Boil the pasta in salted water until al dente.
2. Simmer the tomatoes and oil for 15 minutes, then toss with the drained pasta.

> **Instruction accuracy estimate: High (88%)**
>
> AI best-judgment estimate based on common cooking patterns; not independently tested or verified. The sequence and timing follow a common tomato-pasta method.`,
		required: [/200 g dried pasta/, /400 g canned tomatoes/, /until al dente/, /Simmer.+15 minutes/]
	},
	{
		name: 'poultry instructions with a safe doneness cue',
		markdown: `# Sheet-Pan Chicken
**Servings:** 4
**Estimated time:** 45 minutes
**Guidance level:** Standard

## Ingredients
- 700 g boneless chicken thighs
- 500 g mixed vegetables
- 2 tbsp cooking oil
- Salt to taste

> **Ingredient accuracy estimate: High (84%)**
>
> AI best-judgment estimate based on common cooking patterns; not independently tested or verified. The quantities are plausible for four servings.

## Instructions
1. Roast the seasoned chicken and vegetables at 220°C (425°F).
2. Cook until the chicken reaches 74°C (165°F) internally, then rest for 5 minutes.

> **Instruction accuracy estimate: High (92%)**
>
> AI best-judgment estimate based on common cooking patterns; not independently tested or verified. The method includes a recognized poultry doneness check.`,
		required: [/700 g boneless chicken thighs/, /220°C \(425°F\)/, /74°C \(165°F\)/]
	},
	{
		name: 'incomplete poultry guidance that tells the user what to verify',
		markdown: `# Unverified Chicken Method
**Servings:** 4
**Estimated time:** About 40 minutes
**Guidance level:** Beginner

## Ingredients
- 4 chicken pieces
- Seasoning as needed

> **Ingredient accuracy estimate: Medium (60%)**
>
> AI best-judgment estimate based on common cooking patterns; not independently tested or verified. Verify the chicken weight because piece sizes vary widely.

## Instructions
1. Cook the seasoned chicken until done.

> **Instruction accuracy estimate: Low (30%)**
>
> AI best-judgment estimate based on common cooking patterns; not independently tested or verified. Verify the cooking temperature, timing, and a safe internal doneness temperature before proceeding.`,
		required: [/Verify the chicken weight/, /Verify the cooking temperature/, /safe internal doneness temperature/]
	}
] as const;

describe('structured recipe instructions', () => {
	it('defines the complete recipe sections in order', () => {
		const markers = [
			'# {descriptive recipe title}',
			'**Servings:**',
			'**Estimated time:**',
			'**Guidance level:**',
			'## Ingredients',
			'Ingredient accuracy estimate:',
			'## Instructions',
			'Instruction accuracy estimate:'
		];
		const positions = markers.map((marker) => recipeInstructions.indexOf(marker));

		expect(positions.every((position) => position >= 0)).toBe(true);
		expect(positions).toEqual([...positions].sort((left, right) => left - right));
	});

	it('defines honest, accessible confidence estimates', () => {
		expect(recipeInstructions).toContain('High only for 80-100%');
		expect(recipeInstructions).toContain('Medium only for 50-79%');
		expect(recipeInstructions).toContain('Low only for 0-49%');
		expect(recipeInstructions).toContain('not independently tested or verified');
		expect(recipeInstructions).toContain('never describe it as measured, source-backed, guaranteed');
	});

	it('requires useful ingredient and instruction checks from working cooking patterns', () => {
		expect(recipeInstructions).toContain('quantity, ratio, compatibility');
		expect(recipeInstructions).toContain('serving-yield, or allergy concern');
		expect(recipeInstructions).toContain('sequence, ingredient-coverage');
		expect(recipeInstructions).toContain('temperature, timing, doneness, or food-safety detail');
	});

	it('keeps narrow cooking answers conversational', () => {
		expect(recipeInstructions).toContain('only for complete recipe proposals or revisions');
		expect(recipeInstructions).toContain('Answer narrow');
	});

	it.each(workingRecipeExamples)('renders the curated $name example with accurate report themes', (example) => {
		for (const requirement of example.required) expect(example.markdown).toMatch(requirement);

		const html = renderSafeMarkdown(example.markdown);
		expect(html.match(/class="recipe-confidence recipe-confidence-/g)).toHaveLength(2);
		expect(html.match(/not independently tested or verified/g)).toHaveLength(2);
	});

	it('does not assign high instruction confidence to the incomplete poultry example', () => {
		const incompletePoultry = workingRecipeExamples[2].markdown;

		expect(incompletePoultry).toContain('Instruction accuracy estimate: Low (30%)');
		expect(incompletePoultry).not.toContain('Instruction accuracy estimate: High');
	});
});
