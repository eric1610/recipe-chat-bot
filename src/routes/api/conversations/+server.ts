import { getDatabase } from '$lib/server/db';
import { conversations, messages } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface MessageRequest {
	conversationId?: string;
	content?: string;
}

function conversationTitle(content: string): string {
	const compact = content.replace(/\s+/g, ' ').trim();
	return compact.length > 80 ? `${compact.slice(0, 77)}…` : compact;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to save cloud conversations.');

	let payload: MessageRequest;
	try {
		payload = (await request.json()) as MessageRequest;
	} catch {
		error(400, 'The message payload is invalid.');
	}

	const content = payload.content?.trim();
	if (!content) error(400, 'Write a message before sending it.');
	if (content.length > 50_000) error(400, 'Messages may contain at most 50,000 characters.');

	const database = getDatabase();
	const now = new Date();
	const conversationId = payload.conversationId ?? crypto.randomUUID();
	let position = 0;

	if (payload.conversationId) {
		const [ownedConversation] = await database
			.select({ id: conversations.id })
			.from(conversations)
			.where(and(eq(conversations.id, conversationId), eq(conversations.userId, session.user.id)))
			.limit(1);
		if (!ownedConversation) error(404, 'Conversation not found.');

		const [latestMessage] = await database
			.select({ position: messages.position })
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.orderBy(desc(messages.position))
			.limit(1);
		position = (latestMessage?.position ?? -1) + 1;

		await database
			.update(conversations)
			.set({ updatedAt: now })
			.where(and(eq(conversations.id, conversationId), eq(conversations.userId, session.user.id)));
	} else {
		await database.insert(conversations).values({
			id: conversationId,
			userId: session.user.id,
			title: conversationTitle(content),
			createdAt: now,
			updatedAt: now,
			archivedAt: null
		});
	}

	const message = {
		id: crypto.randomUUID(),
		conversationId,
		role: 'user' as const,
		content,
		position,
		createdAt: now
	};
	await database.insert(messages).values(message);

	return json(
		{
			conversation: {
				id: conversationId,
				title: payload.conversationId ? undefined : conversationTitle(content),
				createdAt: payload.conversationId ? undefined : now.toISOString(),
				updatedAt: now.toISOString(),
				archivedAt: null
			},
			message: { ...message, createdAt: now.toISOString() }
		},
		{ status: 201 }
	);
};
