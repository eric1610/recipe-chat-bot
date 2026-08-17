import { afterAll, describe, expect, it } from 'vitest';
import { createNeonDatabase, type Database } from '$lib/server/db';
import {
	aiGenerationAttempts,
	aiQuotaWindows,
	conversations,
	messages,
	users
} from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { ConversationAccessError, persistCompletedAssistant, persistUserMessageForGeneration } from './persistence';
import {
	getAiUsage,
	getUtcQuotaWindow,
	markAiAttemptFailed,
	markAiAttemptStarted,
	markOpenRouterLimited,
	OPENROUTER_PROVIDER,
	reserveAiQuota
} from './quota';

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

const describeDatabase = testDatabaseUrl ? describe.sequential : describe.skip;
const usage = {
	inputTokens: 12,
	inputTokenDetails: { noCacheTokens: 12, cacheReadTokens: 0, cacheWriteTokens: 0 },
	outputTokens: 34,
	outputTokenDetails: { textTokens: 34, reasoningTokens: 0 },
	totalTokens: 46
};

describeDatabase('successful-response accounting with PostgreSQL', () => {
	const database = testDatabaseUrl ? createNeonDatabase(testDatabaseUrl) : undefined;

	afterAll(async () => {
		await database?.$client.end();
	});

	it('charges one completed response only after persistence and makes completion idempotent', async () => {
		const db = database as Database;
		const now = new Date('2040-01-10T17:30:00.000Z');
		const window = getUtcQuotaWindow(now);
		const userId = `quota-success-${crypto.randomUUID()}`;
		const conversationId = crypto.randomUUID();
		const userMessageId = crypto.randomUUID();
		const assistantMessageId = crypto.randomUUID();

		try {
			await db.insert(users).values({ id: userId, email: `${userId}@example.test` });
			const reservation = await reserveAiQuota(
				db,
				{ userId, conversationId, userMessageId, isExempt: false, now },
				(transaction) =>
					persistUserMessageForGeneration(transaction, {
						userId,
						conversationId,
						messageId: userMessageId,
						content: 'Make lentil soup.',
						now
					})
			);
			expect(reservation).toMatchObject({ allowed: true, usage: { user: { used: 0 } } });
			expect(await getAiUsage(db, userId, false, now)).toMatchObject({ user: { used: 0 } });

			await markAiAttemptStarted(db, reservation.attemptId!, new Date(now.getTime() + 1_000));
			const completion = {
				attemptId: reservation.attemptId!,
				userId,
				conversationId,
				assistantMessageId,
				content: '## Lentil soup\n\nA complete recipe.',
				usage,
				now: new Date(now.getTime() + 2_000)
			};
			await persistCompletedAssistant(db, completion);
			await persistCompletedAssistant(db, completion);

			expect(await getAiUsage(db, userId, false, completion.now)).toMatchObject({
				user: { used: 1 },
				shared: { state: 'available' }
			});
			const storedMessages = await db
				.select({ id: messages.id, position: messages.position })
				.from(messages)
				.where(eq(messages.conversationId, conversationId));
			expect(storedMessages).toEqual(
				expect.arrayContaining([
					{ id: userMessageId, position: 0 },
					{ id: assistantMessageId, position: 1 }
				])
			);
			expect(storedMessages).toHaveLength(2);

			const [attempt] = await db
				.select({
					status: aiGenerationAttempts.status,
					assistantMessageId: aiGenerationAttempts.assistantMessageId,
					totalTokens: aiGenerationAttempts.totalTokens
				})
				.from(aiGenerationAttempts)
				.where(eq(aiGenerationAttempts.id, reservation.attemptId!));
			expect(attempt).toEqual({ status: 'completed', assistantMessageId, totalTokens: 46 });

			await expect(
				persistCompletedAssistant(db, { ...completion, assistantMessageId: crypto.randomUUID() })
			).rejects.toThrow('already completed with another response');
		} finally {
			await db.delete(users).where(eq(users.id, userId));
			await db.delete(aiQuotaWindows).where(
				and(
					eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER),
					eq(aiQuotaWindows.windowStart, window.start)
				)
			);
		}
	});

	it('keeps failed, cancelled, empty, unauthorized, and provider-limited attempts out of personal usage', async () => {
		const db = database as Database;
		const now = new Date('2040-01-11T17:30:00.000Z');
		const window = getUtcQuotaWindow(now);
		const userId = `quota-failures-${crypto.randomUUID()}`;
		const otherUserId = `quota-failures-other-${crypto.randomUUID()}`;
		const conversationId = crypto.randomUUID();
		const attempts: string[] = [];

		try {
			await db.insert(users).values([
				{ id: userId, email: `${userId}@example.test` },
				{ id: otherUserId, email: `${otherUserId}@example.test` }
			]);
			await db.insert(conversations).values({
				id: conversationId,
				userId,
				title: 'Failure accounting',
				createdAt: now,
				updatedAt: now,
				archivedAt: null
			});

			for (let index = 0; index < 5; index += 1) {
				const reservation = await reserveAiQuota(db, {
					userId,
					conversationId,
					userMessageId: crypto.randomUUID(),
					isExempt: false,
					now: new Date(now.getTime() + index)
				});
				expect(reservation.allowed).toBe(true);
				attempts.push(reservation.attemptId!);
			}

			await markAiAttemptFailed(db, attempts[0], 'provider_timeout', 'failed', now);
			await markAiAttemptFailed(db, attempts[1], 'client_cancelled', 'cancelled', now);
			await expect(
				persistCompletedAssistant(db, {
					attemptId: attempts[2],
					userId,
					conversationId,
					assistantMessageId: crypto.randomUUID(),
					content: '   ',
					usage,
					now
				})
			).rejects.toThrow('empty response');
			await markAiAttemptFailed(db, attempts[2], 'empty_response', 'failed', now);
			await expect(
				persistCompletedAssistant(db, {
					attemptId: attempts[3],
					userId: otherUserId,
					conversationId,
					assistantMessageId: crypto.randomUUID(),
					content: 'Must not persist.',
					usage,
					now
				})
			).rejects.toThrow(ConversationAccessError);
			await markAiAttemptFailed(db, attempts[3], 'assistant_persistence_failed', 'failed', now);
			await markOpenRouterLimited(db, attempts[4], new Date(now.getTime() + 60_000), now);

			expect(await getAiUsage(db, userId, false, now)).toMatchObject({
				user: { used: 0 },
				shared: { state: 'exhausted' }
			});
			const statuses = await db
				.select({ status: aiGenerationAttempts.status, errorCode: aiGenerationAttempts.errorCode })
				.from(aiGenerationAttempts)
				.where(eq(aiGenerationAttempts.userId, userId));
			expect(statuses).toEqual(
				expect.arrayContaining([
					{ status: 'failed', errorCode: 'provider_timeout' },
					{ status: 'cancelled', errorCode: 'client_cancelled' },
					{ status: 'failed', errorCode: 'empty_response' },
					{ status: 'failed', errorCode: 'assistant_persistence_failed' },
					{ status: 'provider_limited', errorCode: 'provider_rate_limit' }
				])
			);
			await expect(
				reserveAiQuota(db, {
					userId,
					conversationId,
					userMessageId: crypto.randomUUID(),
					isExempt: false,
					now
				})
			).resolves.toMatchObject({ allowed: false, reason: 'provider_limit' });
		} finally {
			await db.delete(users).where(eq(users.id, userId));
			await db.delete(users).where(eq(users.id, otherUserId));
			await db.delete(aiQuotaWindows).where(
				and(
					eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER),
					eq(aiQuotaWindows.windowStart, window.start)
				)
			);
		}
	});

	it('serializes concurrent reservations at the personal limit', async () => {
		const db = database as Database;
		const now = new Date('2040-01-12T17:30:00.000Z');
		const window = getUtcQuotaWindow(now);
		const userId = `quota-personal-${crypto.randomUUID()}`;
		const conversationId = crypto.randomUUID();

		try {
			await db.insert(users).values({ id: userId, email: `${userId}@example.test` });
			await db.insert(aiGenerationAttempts).values(
				Array.from({ length: 9 }, () => ({
					id: crypto.randomUUID(),
					userId,
					conversationId,
					userMessageId: crypto.randomUUID(),
					provider: OPENROUTER_PROVIDER,
					model: 'openrouter/free',
					windowStart: window.start,
					status: 'completed' as const,
					createdAt: now,
					completedAt: now
				}))
			);

			const results = await Promise.all(
				Array.from({ length: 2 }, () =>
					reserveAiQuota(db, {
						userId,
						conversationId,
						userMessageId: crypto.randomUUID(),
						isExempt: false,
						now
					})
				)
			);
			expect(results.filter((result) => result.allowed)).toHaveLength(1);
			expect(results.filter((result) => result.reason === 'personal_limit')).toHaveLength(1);
			expect(await getAiUsage(db, userId, false, now)).toMatchObject({ user: { used: 9 } });
		} finally {
			await db.delete(users).where(eq(users.id, userId));
			await db.delete(aiQuotaWindows).where(
				and(
					eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER),
					eq(aiQuotaWindows.windowStart, window.start)
				)
			);
		}
	});

	it('serializes concurrent reservations at the shared limit', async () => {
		const db = database as Database;
		const now = new Date('2040-01-13T17:30:00.000Z');
		const window = getUtcQuotaWindow(now);
		const userIds = [
			`quota-shared-a-${crypto.randomUUID()}`,
			`quota-shared-b-${crypto.randomUUID()}`
		];

		try {
			await db.insert(users).values(userIds.map((id) => ({ id, email: `${id}@example.test` })));
			await db.insert(aiQuotaWindows).values({
				provider: OPENROUTER_PROVIDER,
				windowStart: window.start,
				attemptCount: 49,
				updatedAt: now
			});

			const results = await Promise.all(
				userIds.map((userId) =>
					reserveAiQuota(db, {
						userId,
						conversationId: crypto.randomUUID(),
						userMessageId: crypto.randomUUID(),
						isExempt: true,
						now
					})
				)
			);
			expect(results.filter((result) => result.allowed)).toHaveLength(1);
			expect(results.filter((result) => result.reason === 'shared_limit')).toHaveLength(1);
			const [storedWindow] = await db
				.select({ attemptCount: aiQuotaWindows.attemptCount })
				.from(aiQuotaWindows)
				.where(
					and(
						eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER),
						eq(aiQuotaWindows.windowStart, window.start)
					)
				);
			expect(storedWindow.attemptCount).toBe(50);
		} finally {
			for (const userId of userIds) await db.delete(users).where(eq(users.id, userId));
			await db.delete(aiQuotaWindows).where(
				and(
					eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER),
					eq(aiQuotaWindows.windowStart, window.start)
				)
			);
		}
	});

	it('expires stale in-flight work and isolates personal and shared counts across UTC midnight', async () => {
		const db = database as Database;
		const beforeMidnight = new Date('2040-01-14T23:59:59.000Z');
		const afterMidnight = new Date('2040-01-15T00:00:01.000Z');
		const oldWindow = getUtcQuotaWindow(beforeMidnight);
		const newWindow = getUtcQuotaWindow(afterMidnight);
		const userId = `quota-rollover-${crypto.randomUUID()}`;
		const conversationId = crypto.randomUUID();

		try {
			await db.insert(users).values({ id: userId, email: `${userId}@example.test` });
			const oldReservation = await reserveAiQuota(db, {
				userId,
				conversationId,
				userMessageId: crypto.randomUUID(),
				isExempt: false,
				now: new Date(beforeMidnight.getTime() - 180_000)
			});
			expect(oldReservation.allowed).toBe(true);

			const replacement = await reserveAiQuota(db, {
				userId,
				conversationId,
				userMessageId: crypto.randomUUID(),
				isExempt: false,
				now: beforeMidnight
			});
			expect(replacement).toMatchObject({ allowed: true, usage: { user: { used: 0 } } });
			const [expired] = await db
				.select({ status: aiGenerationAttempts.status, errorCode: aiGenerationAttempts.errorCode })
				.from(aiGenerationAttempts)
				.where(eq(aiGenerationAttempts.id, oldReservation.attemptId!));
			expect(expired).toEqual({ status: 'failed', errorCode: 'attempt_expired' });

			await markAiAttemptFailed(db, replacement.attemptId!, 'test_terminal', 'failed', beforeMidnight);
			const nextDay = await reserveAiQuota(db, {
				userId,
				conversationId,
				userMessageId: crypto.randomUUID(),
				isExempt: false,
				now: afterMidnight
			});
			expect(nextDay).toMatchObject({
				allowed: true,
				usage: { user: { used: 0 }, shared: { state: 'available' } }
			});
			const windows = await db
				.select({ windowStart: aiQuotaWindows.windowStart, attemptCount: aiQuotaWindows.attemptCount })
				.from(aiQuotaWindows)
				.where(eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER));
			expect(windows).toEqual(
				expect.arrayContaining([
					{ windowStart: oldWindow.start, attemptCount: 2 },
					{ windowStart: newWindow.start, attemptCount: 1 }
				])
			);
		} finally {
			await db.delete(users).where(eq(users.id, userId));
			for (const window of [oldWindow, newWindow]) {
				await db.delete(aiQuotaWindows).where(
					and(
						eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER),
						eq(aiQuotaWindows.windowStart, window.start)
					)
				);
			}
		}
	});
});
