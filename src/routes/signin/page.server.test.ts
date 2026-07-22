import { describe, expect, it } from 'vitest';
import { safeRedirect } from '$lib/server/security/redirect';

describe('safe sign-in redirects', () => {
	it('allows only application destinations', () => {
		expect(safeRedirect('/chat')).toBe('/chat');
		expect(safeRedirect('/settings?tab=context')).toBe('/settings?tab=context');
	});

	it.each([
		'https://attacker.example',
		'//attacker.example',
		'/\\attacker.example',
		'/%5cattacker.example',
		'/chat\\@attacker.example',
		'/admin',
		'/chat\u0000'
	])('rejects unsafe destination %s', (destination) => {
		expect(safeRedirect(destination)).toBe('/chat');
	});
});
