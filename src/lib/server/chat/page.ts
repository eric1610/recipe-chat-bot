import { env } from '$env/dynamic/private';
import { error, fail, redirect } from '@sveltejs/kit';
import { getAiUsage, isQuotaExempt } from '$lib/server/ai/quota';
import { loadAllergenWarningTerms } from '$lib/server/allergens';
import { getDatabase, type Database } from '$lib/server/db';
import { conversations, messages, recipeSearches, users } from '$lib/server/db/schema';
import { isUuid, readSameOriginFormData } from '$lib/server/security/request';
import { and, asc, desc, eq } from 'drizzle-orm';

export async function loadChatData(
	userId: string,
	conversationId?: string,
	database: Database = getDatabase()
) {
	const [conversationRecords, [user], allergenTerms] = await Promise.all([
		database
			.select({
				id: conversations.id,
				title: conversations.title,
				createdAt: conversations.createdAt,
				updatedAt: conversations.updatedAt
			})
			.from(conversations)
			.where(eq(conversations.userId, userId))
			.orderBy(desc(conversations.updatedAt)),
		database.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
		loadAllergenWarningTerms(database, userId)
	]);

	let currentConversation = null;
	let currentMessages: Array<{
		id: string;
		conversationId: string;
		role: 'user' | 'assistant' | 'system';
		content: string;
		position: number;
		createdAt: string;
	}> = [];

	if (conversationId) {
		const [ownedConversation] = await database
			.select()
			.from(conversations)
			.where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
			.limit(1);
		if (!ownedConversation) error(404, 'Conversation not found.');

		const [records, searches] = await Promise.all([
			database
				.select()
				.from(messages)
				.where(eq(messages.conversationId, conversationId))
				.orderBy(asc(messages.position)),
			database
				.select()
				.from(recipeSearches)
				.where(and(eq(recipeSearches.conversationId, conversationId), eq(recipeSearches.userId, userId)))
		]);
		const now = new Date();
		const searchByMessage = new Map(searches.map((search) => [search.assistantMessageId, {
			id: search.id,
			assistantMessageId: search.assistantMessageId,
			status: search.expiresAt <= now ? 'expired' as const : search.status,
			selectedCandidateId: search.selectedCandidateId,
			expiresAt: search.expiresAt.toISOString(),
			candidates: search.candidates.map(({ facts: _facts, sourceKey: _sourceKey, ...candidate }) => candidate)
		}]));
		currentConversation = {
			...ownedConversation,
			createdAt: ownedConversation.createdAt.toISOString(),
			updatedAt: ownedConversation.updatedAt.toISOString(),
			archivedAt: ownedConversation.archivedAt?.toISOString() ?? null
		};
		currentMessages = records.map((message) => ({
			...message,
			createdAt: message.createdAt.toISOString(),
			recipeSearch: searchByMessage.get(message.id)
		}));
	}

	return {
		aiUsage: await getAiUsage(
			database,
			userId,
			isQuotaExempt(user?.email, env.AI_DAILY_CAP_EXEMPT_EMAILS ?? '')
		),
		conversations: conversationRecords.map((conversation) => ({
			...conversation,
			createdAt: conversation.createdAt.toISOString(),
			updatedAt: conversation.updatedAt.toISOString()
		})),
		allergenTerms,
		currentConversation,
		messages: currentMessages
	};
}

export async function deleteChatConversation(
	request: Request,
	locals: App.Locals,
	url: URL,
	activeConversationId?: string
) {
	const session = await locals.auth();
	if (!session?.user?.id) return fail(401, { deleteError: 'Sign in to delete conversations.' });

	const formData = await readSameOriginFormData(request, url, 1_024);
	const conversationId = formData.get('conversationId');
	if (!isUuid(conversationId)) {
		return fail(400, { deleteError: 'A valid conversation ID is required.' });
	}

	await getDatabase()
		.delete(conversations)
		.where(and(eq(conversations.id, conversationId), eq(conversations.userId, session.user.id)));
	if (conversationId === activeConversationId) redirect(303, '/chat');
	return { deleted: true };
}
