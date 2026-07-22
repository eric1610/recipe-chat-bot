import type { Database } from '$lib/server/db';
import { conversations, messages, securityRateLimits } from '$lib/server/db/schema';
import { and, count, eq, lt, sql } from 'drizzle-orm';

export const storageLimits = {
	conversations: 200,
	messages: 5_000,
	messageBytes: 10 * 1024 * 1024
} as const;

export interface RateLimitResult {
	allowed: boolean;
	retryAfter: number;
}

export async function consumeRateLimit(
	database: Database,
	userId: string,
	action: string,
	limit: number,
	windowMs: number
): Promise<RateLimitResult> {
	const now = Date.now();
	const windowStartMs = Math.floor(now / windowMs) * windowMs;
	const windowStart = new Date(windowStartMs);
	const expiresAt = new Date(windowStartMs + windowMs * 2);
	const key = `${userId}:${action}:${windowStartMs}`;

	await database.delete(securityRateLimits).where(lt(securityRateLimits.expiresAt, new Date(now)));
	const [record] = await database
		.insert(securityRateLimits)
		.values({ key, userId, action, windowStart, count: 1, expiresAt })
		.onConflictDoUpdate({
			target: securityRateLimits.key,
			set: { count: sql`${securityRateLimits.count} + 1` }
		})
		.returning({ count: securityRateLimits.count });

	return {
		allowed: record.count <= limit,
		retryAfter: Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000))
	};
}

export async function getStorageUsage(database: Database, userId: string) {
	const [conversationUsage] = await database
		.select({ count: count() })
		.from(conversations)
		.where(eq(conversations.userId, userId));
	const [messageUsage] = await database
		.select({
			count: count(),
			bytes: sql<number>`coalesce(sum(octet_length(${messages.content})), 0)`
		})
		.from(messages)
		.innerJoin(conversations, eq(messages.conversationId, conversations.id))
		.where(and(eq(conversations.userId, userId), sql`${messages.content} is not null`));

	return {
		conversations: conversationUsage.count,
		messages: messageUsage.count,
		messageBytes: Number(messageUsage.bytes)
	};
}

export async function hasStorageCapacity(
	database: Database,
	userId: string,
	additional: { conversations: number; messages: number; messageBytes: number }
) {
	const usage = await getStorageUsage(database, userId);
	return (
		usage.conversations + additional.conversations <= storageLimits.conversations &&
		usage.messages + additional.messages <= storageLimits.messages &&
		usage.messageBytes + additional.messageBytes <= storageLimits.messageBytes
	);
}
