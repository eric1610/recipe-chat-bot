import type { Database } from '$lib/server/db';
import { aiGenerationAttempts, aiQuotaWindows } from '$lib/server/db/schema';
import { getUtcQuotaWindow, OPENROUTER_PROVIDER } from '$lib/server/ai/quota';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

export const RECENT_PROVIDER_HEALTH_WINDOW_MS = 15 * 60_000;

export type HealthStatus = 'ok' | 'degraded' | 'unavailable';
export type HealthComponent = { status: HealthStatus; code: string };

export interface DetailedHealth {
	status: HealthStatus;
	checkedAt: string;
	checks: {
		application: HealthComponent;
		database: HealthComponent;
		aiProvider: HealthComponent;
	};
}

export interface RecentProviderState {
	providerBlockedUntil: Date | null;
	latestAttempt: {
		status: string;
		errorCode: string | null;
	} | null;
}

export function assessAiProviderHealth(
	configured: boolean,
	state: RecentProviderState,
	now: Date
): HealthComponent {
	if (!configured) return { status: 'unavailable', code: 'not_configured' };
	if (state.providerBlockedUntil && state.providerBlockedUntil > now) {
		return { status: 'degraded', code: 'provider_limited' };
	}
	if (!state.latestAttempt) return { status: 'ok', code: 'no_recent_activity' };
	if (state.latestAttempt.status === 'completed') {
		return { status: 'ok', code: 'recent_success' };
	}
	if (
		state.latestAttempt.status === 'provider_limited' ||
		state.latestAttempt.errorCode === 'provider_rate_limit'
	) {
		return { status: 'degraded', code: 'provider_limited' };
	}
	if (
		state.latestAttempt.errorCode === 'provider_unavailable' ||
		state.latestAttempt.errorCode === 'generation_failed'
	) {
		return { status: 'degraded', code: 'recent_provider_failure' };
	}
	return { status: 'ok', code: 'ready' };
}

function overallStatus(database: HealthComponent, aiProvider: HealthComponent): HealthStatus {
	if (database.status === 'unavailable' || aiProvider.status === 'unavailable') return 'unavailable';
	if (database.status === 'degraded' || aiProvider.status === 'degraded') return 'degraded';
	return 'ok';
}

export async function inspectSystemHealth(
	database: Database,
	input: { openRouterConfigured: boolean; now?: Date }
): Promise<DetailedHealth> {
	const now = input.now ?? new Date();
	const application = { status: 'ok', code: 'responding' } as const;
	try {
		await database.execute(sql`select 1`);
		const window = getUtcQuotaWindow(now);
		const cutoff = new Date(now.getTime() - RECENT_PROVIDER_HEALTH_WINDOW_MS);
		const [[quotaWindow], [latestAttempt]] = await Promise.all([
			database
				.select({ providerBlockedUntil: aiQuotaWindows.providerBlockedUntil })
				.from(aiQuotaWindows)
				.where(
					and(
						eq(aiQuotaWindows.provider, OPENROUTER_PROVIDER),
						eq(aiQuotaWindows.windowStart, window.start)
					)
				)
				.limit(1),
			database
				.select({
					status: aiGenerationAttempts.status,
					errorCode: aiGenerationAttempts.errorCode
				})
				.from(aiGenerationAttempts)
				.where(
					and(
						eq(aiGenerationAttempts.provider, OPENROUTER_PROVIDER),
						gte(aiGenerationAttempts.completedAt, cutoff),
						inArray(aiGenerationAttempts.status, [
							'completed',
							'failed',
							'cancelled',
							'provider_limited'
						])
					)
				)
				.orderBy(desc(aiGenerationAttempts.completedAt))
				.limit(1)
		]);
		const databaseHealth: HealthComponent = { status: 'ok', code: 'reachable' };
		const aiProvider = assessAiProviderHealth(
			input.openRouterConfigured,
			{
				providerBlockedUntil: quotaWindow?.providerBlockedUntil ?? null,
				latestAttempt: latestAttempt ?? null
			},
			now
		);
		return {
			status: overallStatus(databaseHealth, aiProvider),
			checkedAt: now.toISOString(),
			checks: { application, database: databaseHealth, aiProvider }
		};
	} catch {
		return {
			status: 'unavailable',
			checkedAt: now.toISOString(),
			checks: {
				application,
				database: { status: 'unavailable', code: 'unreachable' },
				aiProvider: { status: 'unavailable', code: 'database_unavailable' }
			}
		};
	}
}
