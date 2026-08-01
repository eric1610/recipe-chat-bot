import { afterAll, describe, expect, it } from 'vitest';
import { createNeonDatabase, type Database } from '$lib/server/db';
import { securityRateLimits, users } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { consumeRateLimit } from './limits';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationRequired = process.env.REQUIRE_DATABASE_INTEGRATION === 'true';

if (integrationRequired && !testDatabaseUrl) {
	throw new Error('TEST_DATABASE_URL is required for the database integration suite.');
}
if (testDatabaseUrl) {
	const testUrl = new URL(testDatabaseUrl);
	if (!testUrl.pathname.toLowerCase().includes('test')) {
		throw new Error('TEST_DATABASE_URL must name an isolated database containing "test".');
	}
	if (process.env.DATABASE_URL) {
		const runtimeUrl = new URL(process.env.DATABASE_URL);
		const testIdentity = `${testUrl.hostname}:${testUrl.port || '5432'}${testUrl.pathname}`;
		const runtimeIdentity = `${runtimeUrl.hostname}:${runtimeUrl.port || '5432'}${runtimeUrl.pathname}`;
		if (testIdentity === runtimeIdentity) {
			throw new Error('TEST_DATABASE_URL must never identify the DATABASE_URL database.');
		}
	}
}

const describeDatabase = testDatabaseUrl ? describe : describe.skip;

describeDatabase('per-user limiter concurrency with PostgreSQL', () => {
	const database = testDatabaseUrl ? createNeonDatabase(testDatabaseUrl) : undefined;

	afterAll(async () => {
		await database?.$client.end();
	});

	it('caps one window and isolates the next window, action, and user', async () => {
		const db = database as Database;
		const ownerId = `rate-owner-${crypto.randomUUID()}`;
		const otherId = `rate-other-${crypto.randomUUID()}`;
		const action = `chat-${crypto.randomUUID()}`;
		const now = new Date('2030-05-10T17:30:15.000Z');

		try {
			await db.insert(users).values([
				{ id: ownerId, email: `${ownerId}@example.test` },
				{ id: otherId, email: `${otherId}@example.test` }
			]);

			const burst = await Promise.all(
				Array.from({ length: 25 }, () => consumeRateLimit(db, ownerId, action, 10, 60_000, now))
			);
			expect(burst.filter(({ allowed }) => allowed)).toHaveLength(10);
			expect(burst.filter(({ allowed }) => !allowed)).toHaveLength(15);
			await expect(consumeRateLimit(db, ownerId, action, 10, 60_000, now)).resolves.toEqual({
				allowed: false,
				retryAfter: 45
			});

			const [capped] = await db
				.select({ count: securityRateLimits.count })
				.from(securityRateLimits)
				.where(
					and(
						eq(securityRateLimits.userId, ownerId),
						eq(securityRateLimits.action, action)
					)
				)
				.limit(1);
			expect(capped.count).toBe(11);

			await expect(
				consumeRateLimit(db, ownerId, action, 10, 60_000, new Date(now.getTime() + 60_000))
			).resolves.toMatchObject({ allowed: true });
			await expect(consumeRateLimit(db, ownerId, `${action}-other`, 10, 60_000, now)).resolves
				.toMatchObject({ allowed: true });
			await expect(consumeRateLimit(db, otherId, action, 10, 60_000, now)).resolves.toMatchObject({
				allowed: true
			});
		} finally {
			await db.delete(users).where(eq(users.id, ownerId));
			await db.delete(users).where(eq(users.id, otherId));
		}
	});
});
