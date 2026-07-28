import { describe, expect, it } from 'vitest';
import { safeRedirect } from '$lib/server/security/redirect';

describe('safe sign-in redirects', () => {
	it('allows only application destinations', () => {
		expect(safeRedirect('/chat')).toBe('/chat');
		expect(safeRedirect('/chat/018f47a2-2d8e-7a15-8f7e-0123456789ab')).toBe(
			'/chat/018f47a2-2d8e-7a15-8f7e-0123456789ab'
		);
		expect(safeRedirect('/settings?tab=context')).toBe('/settings?tab=context');
	});

	it.each([
		'https://attacker.example',
		'//attacker.example',
		'/\\attacker.example',
		'/%5cattacker.example',
		'/chat\\@attacker.example',
		'/chat/not-a-conversation',
		'/chat/018f47a2-2d8e-7a15-8f7e-0123456789ab/extra',
		'/admin',
		'/chat\u0000'
	])('rejects unsafe destination %s', (destination) => {
		expect(safeRedirect(destination)).toBe('/chat');
	});
});
