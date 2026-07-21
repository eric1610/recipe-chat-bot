import { parseConversationImport } from '$lib/server/chat/import';
import { getDatabase } from '$lib/server/db';
import { conversations, messages } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in before importing guest history.');

	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin imports are not allowed.');

	let payload;
	try {
		payload = parseConversationImport(await request.json());
	} catch (cause) {
		error(400, cause instanceof Error ? cause.message : 'The import payload is invalid.');
	}

	const database = getDatabase();
	await database.transaction(async (transaction) => {
		for (const conversation of payload.conversations) {
			await transaction
				.insert(conversations)
				.values({
					id: conversation.id,
					userId: session.user.id,
					title: conversation.title,
					createdAt: new Date(conversation.createdAt),
					updatedAt: new Date(conversation.updatedAt),
					archivedAt: conversation.archivedAt ? new Date(conversation.archivedAt) : null
				})
				.onConflictDoNothing();

			const [ownedConversation] = await transaction
				.select({ id: conversations.id })
				.from(conversations)
				.where(and(eq(conversations.id, conversation.id), eq(conversations.userId, session.user.id)))
				.limit(1);

			if (!ownedConversation) error(409, 'A conversation ID conflicts with another account.');
		}

		if (payload.messages.length > 0) {
			await transaction
				.insert(messages)
				.values(
					payload.messages.map((message) => ({
						id: message.id,
						conversationId: message.conversationId,
						role: message.role,
						content: message.content,
						position: message.position,
						createdAt: new Date(message.createdAt)
					}))
				)
				.onConflictDoNothing();
		}
	});

	return json({ imported: payload.conversations.map((conversation) => conversation.id) });
};
