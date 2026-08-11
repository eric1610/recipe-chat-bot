import type { Database } from '$lib/server/db';
import { recipeSearchQuotaWindows } from '$lib/server/db/schema';
import { consumeRateLimit } from '$lib/server/security/limits';
import { lt, sql } from 'drizzle-orm';

const MINUTE_LIMIT = 5;
const USER_DAILY_LIMIT = 10;
const DEFAULT_SHARED_DAILY_LIMIT = 50;
const DAY_MS = 86_400_000;

function utcWindow(now: Date) {
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	return { start, end: new Date(start.getTime() + DAY_MS) };
}

export async function reserveRecipeSearch(
	database: Database,
	userId: string,
	sharedLimitValue: string | undefined,
	now = new Date()
) {
	const sharedLimit = Math.max(1, Math.min(10_000, Number.parseInt(sharedLimitValue ?? '', 10) || DEFAULT_SHARED_DAILY_LIMIT));
	const minute = await consumeRateLimit(database, userId, 'recipe-search-minute', MINUTE_LIMIT, 60_000, now);
	if (!minute.allowed) return minute;
	const daily = await consumeRateLimit(database, userId, 'recipe-search-day', USER_DAILY_LIMIT, DAY_MS, now);
	if (!daily.allowed) return daily;
	const window = utcWindow(now);
	const [shared] = await database
		.insert(recipeSearchQuotaWindows)
		.values({ windowStart: window.start, searchCount: 1, updatedAt: now })
		.onConflictDoUpdate({
			target: recipeSearchQuotaWindows.windowStart,
			set: { searchCount: sql`${recipeSearchQuotaWindows.searchCount} + 1`, updatedAt: now },
			setWhere: lt(recipeSearchQuotaWindows.searchCount, sharedLimit + 1)
		})
		.returning({ count: recipeSearchQuotaWindows.searchCount });
	return {
		allowed: Boolean(shared && shared.count <= sharedLimit),
		retryAfter: Math.max(1, Math.ceil((window.end.getTime() - now.getTime()) / 1_000))
	};
}
