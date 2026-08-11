import { describe, expect, it } from 'vitest';
import { detectRecipeLookupIntent } from './intent';

describe('recipe lookup intent', () => {
	it.each([
		['Give me a recipe for Thai green curry', 'thai-green-curry'],
		['How do I make paella?', 'paella'],
		['Suggest an Italian dinner', 'italian-dinner'],
		['Please cook me a Moroccan tagine.', 'moroccan-tagine']
	])('detects explicit recipe discovery: %s', (message, key) => {
		expect(detectRecipeLookupIntent(message)?.queryKey).toBe(key);
	});

	it.each([
		'Can I replace fish sauce with soy sauce?',
		'Why did my bread collapse?',
		'I enjoy Thai food.',
		'What temperature is safe for chicken?'
	])('does not search narrow or non-request messages: %s', (message) => {
		expect(detectRecipeLookupIntent(message)).toBeNull();
	});

	it('removes sensitive constraints before creating the external query', () => {
		expect(detectRecipeLookupIntent('Recipe for pad thai without peanuts because I am allergic'))
			.toEqual({ queryText: 'pad thai', queryKey: 'pad-thai' });
	});
});
