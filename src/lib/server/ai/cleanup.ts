import type { Database } from '$lib/server/db';
import { aiGenerationAttempts, aiQuotaWindows } from '$lib/server/db/schema';
import { and, inArray, lt, sql } from 'drizzle-orm';
import { AI_ATTEMPT_EXPIRY_MS, getUtcQuotaWindow } from './quota';

export const AI_ATTEMPT_RETENTION_DAYS = 7;
export const AI_ATTEMPT_RETENTION_MS = AI_ATTEMPT_RETENTION_DAYS * 86_400_000;
export const AI_CLEANUP_LOCK_NAMESPACE = 5_391_170;
export const AI_CLEANUP_LOCK_ID = 1;

export interface AiCleanupCutoffs {
	now: Date;
	attemptExpiry: Date;
	attemptRetention: Date;
	quotaWindowRetention: Date;
}

export interface AiCleanupResult {
	skipped: boolean;
	expiredAttempts: number;
	deletedAttempts: number;
	deletedWindows: number;
}

export function getAiCleanupCutoffs(now: Date): AiCleanupCutoffs {
	const currentWindow = getUtcQuotaWindow(now);
	return {
		now,
		attemptExpiry: new Date(now.getTime() - AI_ATTEMPT_EXPIRY_MS),
		attemptRetention: new Date(now.getTime() - AI_ATTEMPT_RETENTION_MS),
		// Keep the current and immediately previous UTC windows so a cross-midnight attempt
		// cannot lose the provider window it reserved against.
		quotaWindowRetention: new Date(currentWindow.start.getTime() - 86_400_000)
	};
}

export async function cleanupAiQuota(
	database: Database,
	overrideNow?: Date
): Promise<AiCleanupResult> {
	return database.transaction(async (transaction) => {
		const tx = transaction as unknown as Database;
		const lockResult = await tx.execute<{ acquired: boolean }>(
			sql`select pg_try_advisory_xact_lock(${AI_CLEANUP_LOCK_NAMESPACE}, ${AI_CLEANUP_LOCK_ID}) as acquired`
		);
		const [lock] = lockResult.rows;
		if (!lock.acquired) {
			return {
				skipped: true,
				expiredAttempts: 0,
				deletedAttempts: 0,
				deletedWindows: 0
			};
		}

		const clockResult = overrideNow
			? { rows: [{ now: overrideNow }] }
			: await tx.execute<{ now: Date }>(sql`select transaction_timestamp() as now`);
		const [clock] = clockResult.rows;
		const cutoffs = getAiCleanupCutoffs(clock.now);

		// Delete outside-retention records first so operation counts remain disjoint.
		const deletedAttempts = await tx
			.delete(aiGenerationAttempts)
			.where(lt(aiGenerationAttempts.createdAt, cutoffs.attemptRetention))
			.returning({ id: aiGenerationAttempts.id });
		const expiredAttempts = await tx
			.update(aiGenerationAttempts)
			.set({ status: 'failed', errorCode: 'attempt_expired', completedAt: cutoffs.now })
			.where(
				and(
					inArray(aiGenerationAttempts.status, ['reserved', 'started']),
					lt(aiGenerationAttempts.createdAt, cutoffs.attemptExpiry)
				)
			)
			.returning({ id: aiGenerationAttempts.id });
		const deletedWindows = await tx
			.delete(aiQuotaWindows)
			.where(lt(aiQuotaWindows.windowStart, cutoffs.quotaWindowRetention))
			.returning({ provider: aiQuotaWindows.provider });

		return {
			skipped: false,
			expiredAttempts: expiredAttempts.length,
			deletedAttempts: deletedAttempts.length,
			deletedWindows: deletedWindows.length
		};
	});
}
