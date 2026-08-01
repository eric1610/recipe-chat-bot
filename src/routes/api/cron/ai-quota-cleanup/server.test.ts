import { describe, expect, it, vi } from 'vitest';
import type { Database } from '$lib/server/db';
import { _createCronCleanupHandler } from './+server';

const secret = 'a'.repeat(64);

function event(authorization?: string) {
	return {
		request: new Request('https://example.test/api/cron/ai-quota-cleanup', {
			headers: authorization ? { authorization } : undefined
		})
	} as Parameters<ReturnType<typeof _createCronCleanupHandler>>[0];
}

describe('AI quota cleanup endpoint', () => {
	it.each([
		['missing configuration', undefined, undefined, 503],
		['short configuration', 'short', undefined, 503],
		['missing authorization', secret, undefined, 401],
		['malformed authorization', secret, secret, 401],
		['incorrect authorization', secret, `Bearer ${'b'.repeat(64)}`, 401]
	])('rejects %s before database access', async (_name, configured, authorization, status) => {
		const getDatabase = vi.fn();
		const cleanup = vi.fn();
		const handler = _createCronCleanupHandler({
			getSecret: () => configured,
			getDatabase,
			cleanup,
			logFailure: vi.fn()
		});
		const response = await handler(event(authorization));
		expect(response.status).toBe(status);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(getDatabase).not.toHaveBeenCalled();
		expect(cleanup).not.toHaveBeenCalled();
	});

	it('returns aggregate cleanup results for an authorized invocation', async () => {
		const database = {} as Database;
		const cleanup = vi.fn().mockResolvedValue({
			skipped: false,
			expiredAttempts: 2,
			deletedAttempts: 3,
			deletedWindows: 1,
			deletedRateLimits: 4
		});
		const handler = _createCronCleanupHandler({
			getSecret: () => secret,
			getDatabase: () => database,
			cleanup,
			logFailure: vi.fn()
		});
		const response = await handler(event(`Bearer ${secret}`));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			ok: true,
			skipped: false,
			expiredAttempts: 2,
			deletedAttempts: 3,
			deletedWindows: 1,
			deletedRateLimits: 4
		});
		expect(cleanup).toHaveBeenCalledWith(database);
	});

	it('sanitizes transaction failures and logs no error object', async () => {
		const logFailure = vi.fn();
		const handler = _createCronCleanupHandler({
			getSecret: () => secret,
			getDatabase: () => ({} as Database),
			cleanup: vi.fn().mockRejectedValue(new Error('database details')),
			logFailure
		});
		const response = await handler(event(`Bearer ${secret}`));
		expect(response.status).toBe(500);
		expect(response.headers.get('cache-control')).toBe('private, no-store');
		expect(await response.text()).not.toContain('database details');
		expect(logFailure).toHaveBeenCalledWith();
	});
});
