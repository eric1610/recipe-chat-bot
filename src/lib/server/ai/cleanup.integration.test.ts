import { afterAll, describe, expect, it } from 'vitest';
import { createNeonDatabase, type Database } from '$lib/server/db';
import {
	aiGenerationAttempts,
	aiQuotaWindows,
	conversations,
	messages,
	userPreferences,
	users
} from '$lib/server/db/schema';
import { count, eq, sql } from 'drizzle-orm';
import {
	AI_CLEANUP_LOCK_ID,
	AI_CLEANUP_LOCK_NAMESPACE,
	cleanupAiQuota
} from './cleanup';

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

describeDatabase('AI quota cleanup with PostgreSQL', () => {
	const database = testDatabaseUrl ? createNeonDatabase(testDatabaseUrl) : undefined;

	afterAll(async () => {
		await database?.$client.end();
	});

	it('enforces retention boundaries without touching user content or recent quota state', async () => {
		const db = database as Database;
		const now = new Date('2030-05-10T17:30:00.000Z');
		const userId = `cleanup-test-${crypto.randomUUID()}`;
		const conversationId = crypto.randomUUID();
		const messageId = crypto.randomUUID();
		const provider = `cleanup-test-${crypto.randomUUID()}`;
		const oldAttemptId = crypto.randomUUID();
		const retentionBoundaryAttemptId = crypto.randomUUID();
		const staleAttemptId = crypto.randomUUID();
		const boundaryAttemptId = crypto.randomUUID();
		const completedAttemptId = crypto.randomUUID();
		const currentWindow = new Date('2030-05-10T00:00:00.000Z');
		const previousWindow = new Date('2030-05-09T00:00:00.000Z');
		const oldWindow = new Date('2030-05-08T00:00:00.000Z');

		try {
			await db.insert(users).values({ id: userId, email: `${userId}@example.test` });
			await db.insert(userPreferences).values({ userId });
			await db.insert(conversations).values({
				id: conversationId,
				userId,
				title: 'Cleanup safety fixture',
				createdAt: now,
				updatedAt: now,
				archivedAt: null
			});
			await db.insert(messages).values({
				id: messageId,
				conversationId,
				role: 'user',
				content: 'Keep this conversation.',
				position: 0,
				createdAt: now
			});
			await db.insert(aiGenerationAttempts).values([
				{
					id: oldAttemptId,
					userId,
					conversationId,
					userMessageId: crypto.randomUUID(),
					provider,
					model: 'test-model',
					windowStart: oldWindow,
					status: 'failed',
					createdAt: new Date(now.getTime() - 8 * 86_400_000),
					completedAt: new Date(now.getTime() - 8 * 86_400_000)
				},
				{
					id: retentionBoundaryAttemptId,
					userId,
					conversationId,
					userMessageId: crypto.randomUUID(),
					provider,
					model: 'test-model',
					windowStart: oldWindow,
					status: 'failed',
					createdAt: new Date(now.getTime() - 7 * 86_400_000),
					completedAt: new Date(now.getTime() - 7 * 86_400_000)
				},
				{
					id: staleAttemptId,
					userId,
					conversationId,
					userMessageId: crypto.randomUUID(),
					provider,
					model: 'test-model',
					windowStart: currentWindow,
					status: 'started',
					createdAt: new Date(now.getTime() - 120_001)
				},
				{
					id: boundaryAttemptId,
					userId,
					conversationId,
					userMessageId: crypto.randomUUID(),
					provider,
					model: 'test-model',
					windowStart: currentWindow,
					status: 'reserved',
					createdAt: new Date(now.getTime() - 120_000)
				},
				{
					id: completedAttemptId,
					userId,
					conversationId,
					userMessageId: crypto.randomUUID(),
					assistantMessageId: crypto.randomUUID(),
					provider,
					model: 'test-model',
					windowStart: currentWindow,
					status: 'completed',
					createdAt: new Date(now.getTime() - 60_000),
					completedAt: now,
					totalTokens: 42
				}
			]);
			await db.insert(aiQuotaWindows).values([
				{ provider, windowStart: oldWindow, attemptCount: 4, updatedAt: now },
				{ provider, windowStart: previousWindow, attemptCount: 5, updatedAt: now },
				{
					provider,
					windowStart: currentWindow,
					attemptCount: 49,
					providerBlockedUntil: new Date('2030-05-10T18:00:00.000Z'),
					updatedAt: now
				}
			]);

			await expect(cleanupAiQuota(db, now)).resolves.toEqual({
				skipped: false,
				expiredAttempts: 1,
				deletedAttempts: 1,
				deletedWindows: 1
			});

			const attempts = await db
				.select({
					id: aiGenerationAttempts.id,
					status: aiGenerationAttempts.status,
					errorCode: aiGenerationAttempts.errorCode,
					totalTokens: aiGenerationAttempts.totalTokens
				})
				.from(aiGenerationAttempts)
				.where(eq(aiGenerationAttempts.userId, userId));
			expect(attempts).not.toContainEqual(expect.objectContaining({ id: oldAttemptId }));
			expect(attempts).toContainEqual({
				id: retentionBoundaryAttemptId,
				status: 'failed',
				errorCode: null,
				totalTokens: null
			});
			expect(attempts).toContainEqual({
				id: staleAttemptId,
				status: 'failed',
				errorCode: 'attempt_expired',
				totalTokens: null
			});
			expect(attempts).toContainEqual({
				id: boundaryAttemptId,
				status: 'reserved',
				errorCode: null,
				totalTokens: null
			});
			expect(attempts).toContainEqual({
				id: completedAttemptId,
				status: 'completed',
				errorCode: null,
				totalTokens: 42
			});

			const [[conversationCount], [messageCount], [preferenceCount]] = await Promise.all([
				db
					.select({ count: count() })
					.from(conversations)
					.where(eq(conversations.userId, userId)),
				db
					.select({ count: count() })
					.from(messages)
					.where(eq(messages.conversationId, conversationId)),
				db
					.select({ count: count() })
					.from(userPreferences)
					.where(eq(userPreferences.userId, userId))
			]);
			expect({
				conversations: conversationCount.count,
				messages: messageCount.count,
				preferences: preferenceCount.count
			}).toEqual({ conversations: 1, messages: 1, preferences: 1 });

			const windows = await db
				.select({
					windowStart: aiQuotaWindows.windowStart,
					attemptCount: aiQuotaWindows.attemptCount,
					providerBlockedUntil: aiQuotaWindows.providerBlockedUntil
				})
				.from(aiQuotaWindows)
				.where(eq(aiQuotaWindows.provider, provider));
			expect(windows).toHaveLength(2);
			expect(windows).toContainEqual(
				expect.objectContaining({ windowStart: previousWindow, attemptCount: 5 })
			);
			expect(windows).toContainEqual({
				windowStart: currentWindow,
				attemptCount: 49,
				providerBlockedUntil: new Date('2030-05-10T18:00:00.000Z')
			});

			await expect(cleanupAiQuota(db, now)).resolves.toEqual({
				skipped: false,
				expiredAttempts: 0,
				deletedAttempts: 0,
				deletedWindows: 0
			});
		} finally {
			await db.delete(users).where(eq(users.id, userId));
			await db.delete(aiQuotaWindows).where(eq(aiQuotaWindows.provider, provider));
		}
	});

	it('skips cleanly while another cleanup transaction owns the advisory lock', async () => {
		const db = database as Database;
		let releaseLock = () => {};
		let reportLocked = () => {};
		const locked = new Promise<void>((resolve) => {
			reportLocked = resolve;
		});
		const release = new Promise<void>((resolve) => {
			releaseLock = resolve;
		});
		const holder = db.transaction(async (transaction) => {
			const tx = transaction as unknown as Database;
			const lockResult = await tx.execute<{ acquired: boolean }>(
				sql`select pg_try_advisory_xact_lock(${AI_CLEANUP_LOCK_NAMESPACE}, ${AI_CLEANUP_LOCK_ID}) as acquired`
			);
			const [lock] = lockResult.rows;
			expect(lock.acquired).toBe(true);
			reportLocked();
			await release;
		});

		await locked;
		try {
			await expect(cleanupAiQuota(db, new Date())).resolves.toEqual({
				skipped: true,
				expiredAttempts: 0,
				deletedAttempts: 0,
				deletedWindows: 0
			});
		} finally {
			releaseLock();
			await holder;
		}
	});
});
