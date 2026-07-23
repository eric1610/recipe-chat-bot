import { env } from '$env/dynamic/private';
import { getDatabase } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { getAiUsage, isQuotaExempt } from '$lib/server/ai/quota';
import { eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to view AI usage.');

	const database = getDatabase();
	const [user] = await database
		.select({ email: users.email })
		.from(users)
		.where(eq(users.id, session.user.id))
		.limit(1);
	if (!user) error(401, 'Your account session is no longer valid.');

	return json(
		await getAiUsage(
			database,
			session.user.id,
			isQuotaExempt(user.email, env.AI_DAILY_CAP_EXEMPT_EMAILS ?? '')
		)
	);
};
