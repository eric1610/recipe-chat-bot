import { Parser } from 'htmlparser2';
import type { RecipeFacts } from '$lib/recipes/types';

const MAX_ITEMS = 100;
const MAX_ITEM_CHARACTERS = 500;

function strings(value: unknown): string[] {
	const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
	return values
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_CHARACTERS))
		.filter(Boolean)
		.slice(0, MAX_ITEMS);
}

function typeIncludesRecipe(value: unknown): boolean {
	return value === 'Recipe' || (Array.isArray(value) && value.includes('Recipe'));
}

function recipeNodes(value: unknown): Record<string, unknown>[] {
	if (Array.isArray(value)) return value.flatMap(recipeNodes);
	if (!value || typeof value !== 'object') return [];
	const record = value as Record<string, unknown>;
	return [
		...(typeIncludesRecipe(record['@type']) ? [record] : []),
		...recipeNodes(record['@graph'])
	];
}

function instructionText(value: unknown): string[] {
	if (typeof value === 'string') return strings(value.split(/\r?\n+/));
	if (!Array.isArray(value)) return [];
	const output: string[] = [];
	for (const item of value) {
		if (typeof item === 'string') output.push(...strings(item));
		else if (item && typeof item === 'object') {
			const record = item as Record<string, unknown>;
			if (record.text) output.push(...strings(record.text));
			if (record.itemListElement) output.push(...instructionText(record.itemListElement));
		}
		if (output.length >= MAX_ITEMS) break;
	}
	return output.slice(0, MAX_ITEMS);
}

function optionalString(value: unknown): string | null {
	return typeof value === 'string' && value.trim()
		? value.replace(/\s+/g, ' ').trim().slice(0, 200)
		: null;
}

function normalizeRecipe(record: Record<string, unknown>): RecipeFacts | null {
	const title = optionalString(record.name);
	const ingredients = strings(record.recipeIngredient);
	const instructions = instructionText(record.recipeInstructions);
	if (!title || ingredients.length === 0 || instructions.length === 0) return null;
	return {
		title,
		yield: optionalString(Array.isArray(record.recipeYield) ? record.recipeYield[0] : record.recipeYield),
		prepTime: optionalString(record.prepTime),
		cookTime: optionalString(record.cookTime),
		totalTime: optionalString(record.totalTime),
		cuisines: strings(record.recipeCuisine).slice(0, 20),
		categories: strings(record.recipeCategory).slice(0, 20),
		ingredients,
		instructions
	};
}

export function extractRecipeFacts(html: string): RecipeFacts | null {
	const blocks: string[] = [];
	let current: string[] | null = null;
	const parser = new Parser({
		onopentag(name, attributes) {
			if (name === 'script' && attributes.type?.toLowerCase() === 'application/ld+json') current = [];
		},
		ontext(text) {
			if (current) current.push(text);
		},
		onclosetag(name) {
			if (name === 'script' && current) {
				blocks.push(current.join(''));
				current = null;
			}
		}
	});
	parser.write(html);
	parser.end();

	for (const block of blocks) {
		try {
			for (const record of recipeNodes(JSON.parse(block))) {
				const recipe = normalizeRecipe(record);
				if (recipe) return recipe;
			}
		} catch {
			// Ignore malformed JSON-LD blocks and continue to the next structured-data block.
		}
	}
	return null;
}
