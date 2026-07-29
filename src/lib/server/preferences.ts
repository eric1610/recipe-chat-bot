import { emptyPreferences, type CookingSkill, type UserPreferences } from '$lib/chat/types';
import { sanitizeMessageContent } from '$lib/chat/content';

const skills = new Set<CookingSkill>(['beginner', 'intermediate', 'advanced']);
const preferenceFields = new Set([
	'diets',
	'allergies',
	'dislikedIngredients',
	'preferredCuisines',
	'cookingSkill',
	'householdSize',
	'notes'
]);

function validateFormShape(formData: FormData): void {
	const seen = new Set<string>();
	for (const [name, value] of formData.entries()) {
		if (!preferenceFields.has(name)) throw new Error('The preferences form contains an unknown field.');
		if (seen.has(name)) throw new Error('Each preference field may be submitted only once.');
		if (typeof value !== 'string') throw new Error('Preference fields must contain text.');
		seen.add(name);
	}
}

function readString(formData: FormData, name: string): string {
	const value = formData.get(name);
	if (value === null) return '';
	if (typeof value !== 'string') throw new Error('Preference fields must contain text.');
	return value;
}

function parseList(formData: FormData, name: string): string[] {
	const value = readString(formData, name);
	if (value.length > 4_000) throw new Error('Preference lists may contain at most 4,000 characters.');
	const rawItems = value.split(',').map((item) => item.trim()).filter(Boolean);
	if (rawItems.some((item) => item.length > 100)) {
		throw new Error('Preference items may contain at most 100 characters.');
	}
	const items = [...new Set(rawItems.map(sanitizeMessageContent).filter(Boolean))];
	if (items.length > 30) throw new Error('Each preference list may contain at most 30 items.');
	if (items.some((item) => item.length > 100)) throw new Error('Preference items may contain at most 100 characters.');
	return items;
}

export function parsePreferences(formData: FormData): UserPreferences {
	validateFormShape(formData);
	const skillValue = readString(formData, 'cookingSkill');
	const householdValue = readString(formData, 'householdSize');
	const notesValue = readString(formData, 'notes');
	if (skillValue && !skills.has(skillValue as CookingSkill)) {
		throw new Error('Cooking skill must be beginner, intermediate, or advanced.');
	}
	const cookingSkill = skillValue ? (skillValue as CookingSkill) : null;
	const householdSize = householdValue !== '' ? Number(householdValue) : null;

	if (householdSize !== null && (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 30)) {
		throw new Error('Household size must be between 1 and 30.');
	}

	const notes = sanitizeMessageContent(notesValue);
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
