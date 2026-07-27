import { describe, expect, it } from 'vitest';
import { isPrivateRoute } from './headers';

describe('private response headers', () => {
	it('marks authenticated and operational API routes private', () => {
		expect(isPrivateRoute('/chat')).toBe(true);
		expect(isPrivateRoute('/api/chat')).toBe(true);
		expect(isPrivateRoute('/api/cron/ai-quota-cleanup')).toBe(true);
	});

	it('does not mark public landing assets private', () => {
		expect(isPrivateRoute('/')).toBe(false);
		expect(isPrivateRoute('/favicon.svg')).toBe(false);
		expect(isPrivateRoute('/api/chronicle')).toBe(false);
	});
});
