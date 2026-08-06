import { emptyPreferences } from '$lib/chat/types';
import { loadUserAllergies, replaceUserAllergies } from '$lib/server/allergens';
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
	const database = getDatabase();
	const [[record], allergies] = await Promise.all([
		database
			.select()
			.from(userPreferences)
			.where(eq(userPreferences.userId, userId))
			.limit(1),
		loadUserAllergies(database, userId)
	]);

	return {
		preferences: record
			? {
				diets: record.diets,
				allergies,
				dislikedIngredients: record.dislikedIngredients,
				preferredCuisines: record.preferredCuisines,
				cookingSkill: record.cookingSkill,
				householdSize: record.householdSize,
				notes: record.notes
			}
			: { ...emptyPreferences, allergies }
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

		const { allergies, ...preferenceRecord } = preferences;
		await getDatabase().transaction(async (transaction) => {
			const database = transaction as unknown as ReturnType<typeof getDatabase>;
			await database
				.insert(userPreferences)
				.values({ userId, ...preferenceRecord })
				.onConflictDoUpdate({
					target: userPreferences.userId,
					set: { ...preferenceRecord, updatedAt: new Date() }
				});
			await replaceUserAllergies(database, userId, allergies);
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
