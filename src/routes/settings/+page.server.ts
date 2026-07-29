import { emptyPreferences } from '$lib/chat/types';
import { getDatabase } from '$lib/server/db';
import { userPreferences, users } from '$lib/server/db/schema';
import { parsePreferences } from '$lib/server/preferences';
import { readSameOriginFormData } from '$lib/server/security/request';
import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

async function requireUserId(locals: App.Locals): Promise<string> {
	const session = await locals.auth();
	if (!session?.user?.id) redirect(303, '/signin?redirectTo=/settings');
	return session.user.id;
}

export const load: PageServerLoad = async ({ locals }) => {
	const userId = await requireUserId(locals);
	const [record] = await getDatabase()
		.select()
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);

	return {
		preferences: record
			? {
				diets: record.diets,
				allergies: record.allergies,
				dislikedIngredients: record.dislikedIngredients,
				preferredCuisines: record.preferredCuisines,
				cookingSkill: record.cookingSkill,
				householdSize: record.householdSize,
				notes: record.notes
			}
			: emptyPreferences
	};
};

export const actions: Actions = {
	updatePreferences: async ({ request, locals, url }) => {
		const userId = await requireUserId(locals);
		const formData = await readSameOriginFormData(request, url, 24_576);
		let preferences;
		try {
			preferences = parsePreferences(formData);
		} catch (cause) {
			return fail(400, { preferenceError: cause instanceof Error ? cause.message : 'Preferences are invalid.' });
		}

		await getDatabase()
			.insert(userPreferences)
			.values({ userId, ...preferences })
			.onConflictDoUpdate({
				target: userPreferences.userId,
				set: { ...preferences, updatedAt: new Date() }
			});

		return { preferencesSaved: true };
	},

	deleteAccount: async ({ request, locals, cookies, url }) => {
		const userId = await requireUserId(locals);
		const formData = await readSameOriginFormData(request, url, 512);
		if (formData.get('confirmation') !== 'DELETE MY ACCOUNT') {
			return fail(400, { deleteError: 'Type DELETE MY ACCOUNT to confirm permanent deletion.' });
		}
		await getDatabase().delete(users).where(eq(users.id, userId));

		for (const cookie of cookies.getAll()) {
			if (cookie.name.startsWith('authjs.') || cookie.name.startsWith('__Secure-authjs.')) {
				cookies.delete(cookie.name, { path: '/' });
			}
		}

		redirect(303, '/?accountDeleted=true');
	}
};
