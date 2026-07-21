import { emptyPreferences, type CookingSkill, type UserPreferences } from '$lib/chat/types';

const skills = new Set<CookingSkill>(['beginner', 'intermediate', 'advanced']);

function parseList(formData: FormData, name: string): string[] {
	const value = formData.get(name);
	if (typeof value !== 'string') return [];
	if (value.length > 4_000) throw new Error('Preference lists may contain at most 4,000 characters.');
	const items = [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
	if (items.length > 30) throw new Error('Each preference list may contain at most 30 items.');
	if (items.some((item) => item.length > 100)) throw new Error('Preference items may contain at most 100 characters.');
	return items;
}

export function parsePreferences(formData: FormData): UserPreferences {
	const skillValue = formData.get('cookingSkill');
	const householdValue = formData.get('householdSize');
	const notesValue = formData.get('notes');
	const cookingSkill = typeof skillValue === 'string' && skills.has(skillValue as CookingSkill)
		? (skillValue as CookingSkill)
		: null;
	const householdSize = typeof householdValue === 'string' && householdValue !== ''
		? Number(householdValue)
		: null;

	if (householdSize !== null && (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 30)) {
		throw new Error('Household size must be between 1 and 30.');
	}

	const notes = typeof notesValue === 'string' ? notesValue.trim() : '';
	if (notes.length > 2_000) throw new Error('Preference notes may contain at most 2,000 characters.');

	return {
		...emptyPreferences,
		diets: parseList(formData, 'diets'),
		allergies: parseList(formData, 'allergies'),
		dislikedIngredients: parseList(formData, 'dislikedIngredients'),
		preferredCuisines: parseList(formData, 'preferredCuisines'),
		cookingSkill,
		householdSize,
		notes
	};
}
