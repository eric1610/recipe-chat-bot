import { getDatabase, type Database } from '$lib/server/db';
import { conversations, messages } from '$lib/server/db/schema';
import { consumeRateLimit, hasStorageCapacity } from '$lib/server/security/limits';
import { isRecord, isUuid, readSameOriginJson } from '$lib/server/security/request';
import { and, desc, eq, sql } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface MessageRequest {
	conversationId?: string;
	content: string;
}

function conversationTitle(content: string): string {
	const compact = content.replace(/\s+/g, ' ').trim();
	return compact.length > 80 ? `${compact.slice(0, 77)}…` : compact;
}

function parseMessageRequest(value: unknown): MessageRequest {
	if (!isRecord(value)) error(400, 'The message payload must be an object.');
	if (Object.keys(value).some((key) => key !== 'conversationId' && key !== 'content')) {
		error(400, 'The message payload contains unsupported fields.');
	}
	if (typeof value.content !== 'string' || !value.content.trim()) {
		error(400, 'Write a message before sending it.');
	}
	const content = value.content.trim();
	if (content.length > 8_000) error(400, 'Messages may contain at most 8,000 characters.');
	if (value.conversationId !== undefined && !isUuid(value.conversationId)) {
		error(400, 'Conversation IDs must be valid UUIDs.');
	}

	return { conversationId: value.conversationId, content };
}

function rateLimited(retryAfter: number) {
	return json(
		{ message: 'Too many message requests. Try again shortly.' },
		{ status: 429, headers: { 'retry-after': String(retryAfter) } }
	);
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to save cloud conversations.');

	const payload = parseMessageRequest(await readSameOriginJson(request, url));
	const database = getDatabase();
	for (const [action, limit, windowMs] of [
		['message-minute', 30, 60_000],
		['message-day', 300, 86_400_000]
	] as const) {
		const rate = await consumeRateLimit(database, session.user.id, action, limit, windowMs);
		if (!rate.allowed) return rateLimited(rate.retryAfter);
	}

	const now = new Date();
	const conversationId = payload.conversationId ?? crypto.randomUUID();
	const messageBytes = new TextEncoder().encode(payload.content).byteLength;
	const result = await database.transaction(async (transaction) => {
		const tx = transaction as unknown as Database;
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.user.id}))`);
		const hasCapacity = await hasStorageCapacity(tx, session.user.id, {
			conversations: payload.conversationId ? 0 : 1,
			messages: 1,
			messageBytes
		});
		if (!hasCapacity) error(409, 'Your account has reached its conversation storage limit.');

		let position = 0;
		if (payload.conversationId) {
			const [ownedConversation] = await tx
				.select({ id: conversations.id })
				.from(conversations)
				.where(and(eq(conversations.id, conversationId), eq(conversations.userId, session.user.id)))
				.limit(1);
			if (!ownedConversation) error(404, 'Conversation not found.');

			await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${conversationId}))`);
			const [latestMessage] = await tx
				.select({ position: messages.position })
				.from(messages)
				.where(eq(messages.conversationId, conversationId))
				.orderBy(desc(messages.position))
				.limit(1);
			position = (latestMessage?.position ?? -1) + 1;
			await tx
				.update(conversations)
				.set({ updatedAt: now })
				.where(and(eq(conversations.id, conversationId), eq(conversations.userId, session.user.id)));
		} else {
			await tx.insert(conversations).values({
				id: conversationId,
				userId: session.user.id,
				title: conversationTitle(payload.content),
				createdAt: now,
				updatedAt: now,
				archivedAt: null
			});
		}

		const message = {
			id: crypto.randomUUID(),
			conversationId,
			role: 'user' as const,
			content: payload.content,
			position,
			createdAt: now
		};
		await tx.insert(messages).values(message);
		return message;
	});

	return json(
		{
			conversation: {
				id: conversationId,
				title: payload.conversationId ? undefined : conversationTitle(payload.content),
				createdAt: payload.conversationId ? undefined : now.toISOString(),
				updatedAt: now.toISOString(),
				archivedAt: null
			},
			message: { ...result, createdAt: now.toISOString() }
		},
		{ status: 201 }
	);
};
