import { parseConversationImport } from '$lib/server/chat/import';
import { getDatabase, type Database } from '$lib/server/db';
import { conversations, messages } from '$lib/server/db/schema';
import { consumeRateLimit, hasStorageCapacity } from '$lib/server/security/limits';
import { readSameOriginJson } from '$lib/server/security/request';
import { and, eq, sql } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in before importing guest history.');

	let payload;
	try {
		payload = parseConversationImport(await readSameOriginJson(request, url));
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
		error(400, cause instanceof Error ? cause.message : 'The import payload is invalid.');
	}

	const database = getDatabase();
	const rate = await consumeRateLimit(database, session.user.id, 'guest-import', 5, 3_600_000);
	if (!rate.allowed) {
		return json(
			{ message: 'Too many import requests. Try again later.' },
			{ status: 429, headers: { 'retry-after': String(rate.retryAfter) } }
		);
	}

	const messageBytes = payload.messages.reduce(
		(total, message) => total + new TextEncoder().encode(message.content).byteLength,
		0
	);
	const importedAt = Date.now();
	await database.transaction(async (transaction) => {
		const tx = transaction as unknown as Database;
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${session.user.id}))`);
		if (
			!(await hasStorageCapacity(tx, session.user.id, {
				conversations: payload.conversations.length,
				messages: payload.messages.length,
				messageBytes
			}))
		) {
			error(409, 'Importing this history would exceed your account storage limit.');
		}

		for (const [index, conversation] of payload.conversations.entries()) {
			const timestamp = new Date(importedAt + index);
			await tx
				.insert(conversations)
				.values({
					id: conversation.id,
					userId: session.user.id,
					title: conversation.title,
					createdAt: timestamp,
					updatedAt: timestamp,
					archivedAt: null
				})
				.onConflictDoNothing();

			const [ownedConversation] = await tx
				.select({ id: conversations.id })
				.from(conversations)
				.where(and(eq(conversations.id, conversation.id), eq(conversations.userId, session.user.id)))
				.limit(1);
			if (!ownedConversation) error(409, 'A conversation ID conflicts with another account.');
		}

		if (payload.messages.length > 0) {
			const positions = new Map<string, number>();
			await tx
				.insert(messages)
				.values(
					payload.messages.map((message, index) => {
						const position = positions.get(message.conversationId) ?? 0;
						positions.set(message.conversationId, position + 1);
						return {
							id: message.id,
							conversationId: message.conversationId,
							role: 'user' as const,
							content: message.content,
							position,
							createdAt: new Date(importedAt + payload.conversations.length + index)
						};
					})
				)
				.onConflictDoNothing();
		}
	});

	return json({ imported: payload.conversations.map((conversation) => conversation.id) });
};
