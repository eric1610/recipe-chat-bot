import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '$lib/server/db';
import { consumeRateLimit } from './limits';

const returning = vi.fn();
const onConflictDoUpdate = vi.fn(() => ({ returning }));
const values = vi.fn(() => ({ onConflictDoUpdate }));
const insert = vi.fn(() => ({ values }));
const database = { insert } as unknown as Database;

describe('per-user security rate limiting', () => {
	beforeEach(() => vi.clearAllMocks());

	it('derives a deterministic window and retry interval from the supplied clock', async () => {
		returning.mockResolvedValue([{ count: 1 }]);
		const now = new Date('2030-05-10T17:30:15.250Z');

		await expect(
			consumeRateLimit(database, 'user-1', 'chat', 10, 60_000, now)
		).resolves.toEqual({ allowed: true, retryAfter: 45 });
		expect(values).toHaveBeenCalledWith({
			key: `user-1:chat:${new Date('2030-05-10T17:30:00.000Z').getTime()}`,
			userId: 'user-1',
			action: 'chat',
			windowStart: new Date('2030-05-10T17:30:00.000Z'),
			count: 1,
			expiresAt: new Date('2030-05-10T17:32:00.000Z')
		});
	});

	it('allows counts through the limit and rejects the capped and no-update results', async () => {
		const now = new Date('2030-05-10T17:30:15.000Z');
		for (const [result, allowed] of [
			[[{ count: 10 }], true],
			[[{ count: 11 }], false],
			[[], false]
		] as const) {
			returning.mockResolvedValueOnce(result);
			await expect(consumeRateLimit(database, 'user-1', 'chat', 10, 60_000, now)).resolves
				.toMatchObject({ allowed });
		}
		expect(onConflictDoUpdate).toHaveBeenCalledTimes(3);
	});
});
