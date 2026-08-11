import { sanitizeMessageContent } from '$lib/chat/content';

const cuisines = [
	'american', 'brazilian', 'cajun', 'canadian', 'caribbean', 'chinese', 'ethiopian',
	'french', 'greek', 'indian', 'indonesian', 'italian', 'japanese', 'korean', 'lebanese',
	'malaysian', 'mediterranean', 'mexican', 'moroccan', 'nigerian', 'persian', 'filipino',
	'spanish', 'thai', 'turkish', 'vietnamese'
];

const explicitRecipePattern =
	/\b(?:recipe\s+for|find\s+(?:me\s+)?(?:a\s+)?recipe|show\s+me\s+how\s+to|how\s+(?:do|can|should)\s+i\s+(?:make|cook|bake|prepare)|(?:make|cook|bake|prepare)\s+(?:me\s+)?(?:a\s+)?)/i;
const requestPattern = /\b(?:find|give|show|suggest|recommend|want|need|make|cook|prepare|try)\b/i;
const sensitiveSuffix = /\b(?:without|allerg(?:y|ic)|intoleran|for\s+my|my\s+diet|i\s+(?:cannot|can't|do\s+not|don't))\b/i;

export interface RecipeLookupIntent {
	queryText: string;
	queryKey: string;
}

export function detectRecipeLookupIntent(value: string): RecipeLookupIntent | null {
	const content = sanitizeMessageContent(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
	if (!content) return null;
	const cuisinePattern = new RegExp(`\\b(?:${cuisines.join('|')})\\b`, 'i');
	if (!explicitRecipePattern.test(content) && !(requestPattern.test(content) && cuisinePattern.test(content))) {
		return null;
	}

	let queryText = content
		.replace(explicitRecipePattern, '')
		.replace(/^(?:find|give|show|suggest|recommend|want|need|try)(?:\s+me)?\s+/i, '')
		.replace(/^(?:please|could you|would you)\s+/i, '')
		.replace(/^(?:a|an|the)\s+/i, '')
		.trim();
	const privateAt = queryText.search(sensitiveSuffix);
	if (privateAt >= 0) queryText = queryText.slice(0, privateAt).trim();
	queryText = queryText.replace(/[?.!,;:]+$/g, '').trim().slice(0, 160);
	if (queryText.length < 2) return null;

	const queryKey = queryText
		.toLocaleLowerCase('en-CA')
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 160);
	return queryKey ? { queryText, queryKey } : null;
}
