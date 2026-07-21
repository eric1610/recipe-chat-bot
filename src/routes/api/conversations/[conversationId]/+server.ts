import { getDatabase } from '$lib/server/db';
import { conversations, messages } from '$lib/server/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to read cloud conversations.');

	const database = getDatabase();
	const [conversation] = await database
		.select({ id: conversations.id })
		.from(conversations)
		.where(and(eq(conversations.id, params.conversationId), eq(conversations.userId, session.user.id)))
		.limit(1);
	if (!conversation) error(404, 'Conversation not found.');

	const records = await database
		.select()
		.from(messages)
		.where(eq(messages.conversationId, params.conversationId))
		.orderBy(asc(messages.position));

	return json({
		messages: records.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))
	});
};
