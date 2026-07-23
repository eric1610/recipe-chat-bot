import { env } from '$env/dynamic/private';
import { getDatabase } from '$lib/server/db';
import { conversations, users } from '$lib/server/db/schema';
import { getAiUsage, isQuotaExempt } from '$lib/server/ai/quota';
import { and, desc, eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return { session: null, conversations: [], aiUsage: null };

	const database = getDatabase();
	const records = await database
		.select({
			id: conversations.id,
			title: conversations.title,
			createdAt: conversations.createdAt,
			updatedAt: conversations.updatedAt
		})
		.from(conversations)
		.where(eq(conversations.userId, session.user.id))
		.orderBy(desc(conversations.updatedAt));
	const [user] = await database
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, session.user.id))
		.limit(1);

	return {
		session,
		aiUsage: await getAiUsage(
			database,
			session.user.id,
			isQuotaExempt(user?.email, env.AI_DAILY_CAP_EXEMPT_EMAILS ?? '')
		),
		conversations: records.map((conversation) => ({
			...conversation,
			createdAt: conversation.createdAt.toISOString(),
			updatedAt: conversation.updatedAt.toISOString()
		}))
	};
};

export const actions: Actions = {
	deleteConversation: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user?.id) return fail(401, { deleteError: 'Sign in to delete cloud conversations.' });

		const formData = await request.formData();
		const conversationId = formData.get('conversationId');
		if (typeof conversationId !== 'string') return fail(400, { deleteError: 'A conversation ID is required.' });

		await getDatabase()
			.delete(conversations)
			.where(and(eq(conversations.id, conversationId), eq(conversations.userId, session.user.id)));

		return { deleted: true };
	}
};
