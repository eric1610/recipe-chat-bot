import { signIn } from '../../auth';
import { safeRedirect } from '$lib/server/security/redirect';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const redirectTo = safeRedirect(url.searchParams.get('redirectTo'));
	if (await locals.auth()) redirect(303, redirectTo);
	return { redirectTo };
};

export const actions: Actions = { default: signIn };
