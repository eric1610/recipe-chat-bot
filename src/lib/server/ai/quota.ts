import type { AiUsageSnapshot } from '$lib/chat/usage';
import type { Database } from '$lib/server/db';
import { aiGenerationAttempts, aiQuotaWindows } from '$lib/server/db/schema';
import { and, count, eq, sql } from 'drizzle-orm';

export const OPENROUTER_PROVIDER = 'openrouter';
export const OPENROUTER_MODEL = 'openrouter/free';
export const PERSONAL_DAILY_LIMIT = 10;
export const SHARED_DAILY_LIMIT = 50;

export type AiQuotaDenial = 'personal_limit' | 'shared_limit' | 'provider_limit';

export interface AiQuotaWindow {
	start: Date;
	end: Date;
}

export interface AiQuotaReservation {
	allowed: boolean;
	attemptId?: string;
	reason?: AiQuotaDenial;
	retryAfter: number;
	usage: AiUsageSnapshot;
}

export interface AiQuotaPolicyValues {
	personalCount: number;
	sharedCount: number;
	providerBlockedUntil: Date | null;
	isExempt: boolean;
	now: Date;
	windowEnd: Date;
}

export function getUtcQuotaWindow(now = new Date()): AiQuotaWindow {
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	return { start, end: new Date(start.getTime() + 86_400_000) };
}

export function isQuotaExempt(email: string | null | undefined, configuredEmails: string): boolean {
	if (!email) return false;
	const normalized = email.trim().toLowerCase();
	return configuredEmails
		.split(',')
		.map((candidate) => candidate.trim().toLowerCase())
		.filter(Boolean)
		.includes(normalized);
}

export function getQuotaDenial(values: AiQuotaPolicyValues): AiQuotaDenial | null {
	if (values.providerBlockedUntil && values.providerBlockedUntil > values.now) return 'provider_limit';
	if (values.sharedCount >= SHARED_DAILY_LIMIT) return 'shared_limit';
	if (!values.isExempt && values.personalCount >= PERSONAL_DAILY_LIMIT) return 'personal_limit';
	return null;
}

export function createUsageSnapshot(values: AiQuotaPolicyValues): AiUsageSnapshot {
	const providerBlocked = Boolean(
		values.providerBlockedUntil && values.providerBlockedUntil.getTime() > values.now.getTime()
	);
	const sharedState = providerBlocked || values.sharedCount >= SHARED_DAILY_LIMIT
		? 'exhausted'
		: values.sharedCount >= 45
			? 'critical'
			: values.sharedCount >= 40
				? 'near'
				: 'available';
	const personalLimit = values.isExempt ? null : PERSONAL_DAILY_LIMIT;
	const personalState = personalLimit === null
		? 'available'
		: values.personalCount >= personalLimit
			? 'exhausted'
			: values.personalCount >= 8
				? 'near'
				: 'available';

	return {
		user: { used: values.personalCount, limit: personalLimit, state: personalState },
		shared: { state: sharedState, resetsAt: values.windowEnd.toISOString() }
	};
}

export function parseRetryAfter(headers: Record<string, string | undefined> | undefined, now = new Date()): Date | null {
	const value = headers?.['retry-after'];
	if (!value) return null;
	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) return new Date(now.getTime() + seconds * 1_000);
	const timestamp = Date.parse(value);
	return Number.isNaN(timestamp) || timestamp <= now.getTime() ? null : new Date(timestamp);
}

function retryAfterSeconds(until: Date, now: Date): number {
	return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1_000));
}

async function readUsageValues(
	database: Database,
	userId: string,
	window: AiQuotaWindow,
	isExempt: boolean,
	now: Date
): Promise<AiQuotaPolicyValues> {
	const [quotaWindow] = await database
		.select({
			attemptCount: aiQuotaWindows.attemptCount,
			providerBlockedUntil: aiQuotaWindows.providerBlockedUntil
		})
		.from(aiQuotaWindows)
		.where(
			and(
				eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER),
				eq(aiQuotaWindows.windowStart, window.start)
			)
		)
		.limit(1);
	const [personal] = await database
		.select({ count: count() })
		.from(aiGenerationAttempts)
		.where(
			and(
				eq(aiGenerationAttempts.userId, userId),
				eq(aiGenerationAttempts.windowStart, window.start)
			)
		);

	return {
		personalCount: personal.count,
		sharedCount: quotaWindow?.attemptCount ?? 0,
		providerBlockedUntil: quotaWindow?.providerBlockedUntil ?? null,
		isExempt,
		now,
		windowEnd: window.end
	};
}

export async function getAiUsage(
	database: Database,
	userId: string,
	isExempt: boolean,
	now = new Date()
): Promise<AiUsageSnapshot> {
	const window = getUtcQuotaWindow(now);
	return createUsageSnapshot(await readUsageValues(database, userId, window, isExempt, now));
}

export async function reserveAiQuota(
	database: Database,
	input: {
		userId: string;
		conversationId: string;
		userMessageId: string;
		isExempt: boolean;
		now?: Date;
	},
	onReserved?: (transaction: Database, attemptId: string) => Promise<void>
): Promise<AiQuotaReservation> {
	const now = input.now ?? new Date();
	const window = getUtcQuotaWindow(now);

	return database.transaction(async (transaction) => {
		const tx = transaction as unknown as Database;
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext(${`${OPENROUTER_PROVIDER}:${window.start.toISOString()}`}))`
		);
		await tx
			.insert(aiQuotaWindows)
			.values({ provider: OPENROUTER_PROVIDER, windowStart: window.start, attemptCount: 0, updatedAt: now })
			.onConflictDoNothing();

		const values = await readUsageValues(tx, input.userId, window, input.isExempt, now);
		const usage = createUsageSnapshot(values);
		const denial = getQuotaDenial(values);
		if (denial === 'provider_limit') {
			return {
				allowed: false,
				reason: 'provider_limit',
				retryAfter: retryAfterSeconds(values.providerBlockedUntil ?? window.end, now),
				usage
			};
		}
		if (denial === 'shared_limit') {
			return {
				allowed: false,
				reason: 'shared_limit',
				retryAfter: retryAfterSeconds(window.end, now),
				usage
			};
		}
		if (denial === 'personal_limit') {
			return {
				allowed: false,
				reason: 'personal_limit',
				retryAfter: retryAfterSeconds(window.end, now),
				usage
			};
		}

		const attemptId = crypto.randomUUID();
		await tx.insert(aiGenerationAttempts).values({
			id: attemptId,
			userId: input.userId,
			conversationId: input.conversationId,
			userMessageId: input.userMessageId,
			provider: OPENROUTER_PROVIDER,
			model: OPENROUTER_MODEL,
			windowStart: window.start,
			status: 'reserved',
			createdAt: now
		});
		const [updatedWindow] = await tx
			.update(aiQuotaWindows)
			.set({ attemptCount: sql`${aiQuotaWindows.attemptCount} + 1`, updatedAt: now })
			.where(
				and(
					eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER),
					eq(aiQuotaWindows.windowStart, window.start)
				)
			)
			.returning({ attemptCount: aiQuotaWindows.attemptCount });
		await onReserved?.(tx, attemptId);

		return {
			allowed: true,
			attemptId,
			retryAfter: 0,
			usage: createUsageSnapshot({
				...values,
				personalCount: values.personalCount + 1,
				sharedCount: updatedWindow.attemptCount
			})
		};
	});
}

export async function markAiAttemptStarted(
	database: Database,
	attemptId: string,
	now = new Date()
): Promise<void> {
	await database
		.update(aiGenerationAttempts)
		.set({ status: 'started', startedAt: now })
		.where(eq(aiGenerationAttempts.id, attemptId));
}

export async function markAiAttemptFailed(
	database: Database,
	attemptId: string,
	errorCode: string,
	status: 'failed' | 'cancelled' = 'failed',
	now = new Date()
): Promise<void> {
	await database
		.update(aiGenerationAttempts)
		.set({ status, errorCode, completedAt: now })
		.where(eq(aiGenerationAttempts.id, attemptId));
}

export async function markOpenRouterLimited(
	database: Database,
	attemptId: string,
	blockedUntil: Date,
	now = new Date()
): Promise<void> {
	await database.transaction(async (transaction) => {
		const tx = transaction as unknown as Database;
		const [attempt] = await tx
			.select({ provider: aiGenerationAttempts.provider, windowStart: aiGenerationAttempts.windowStart })
			.from(aiGenerationAttempts)
			.where(eq(aiGenerationAttempts.id, attemptId))
			.limit(1);
		if (!attempt) return;
		await tx
			.update(aiQuotaWindows)
			.set({ providerBlockedUntil: blockedUntil, updatedAt: now })
			.where(
				and(
					eq(aiQuotaWindows.provider, attempt.provider),
					eq(aiQuotaWindows.windowStart, attempt.windowStart)
				)
			);
		await tx
			.update(aiGenerationAttempts)
			.set({ status: 'provider_limited', errorCode: 'provider_rate_limit', completedAt: now })
			.where(eq(aiGenerationAttempts.id, attemptId));
	});
}
