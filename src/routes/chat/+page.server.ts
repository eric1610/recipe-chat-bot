import { deleteChatConversation, loadChatData } from '$lib/server/chat/page';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) redirect(303, '/signin?redirectTo=/chat');
	return { session, ...(await loadChatData(session.user.id)) };
};

export const actions: Actions = {
	deleteConversation: ({ request, locals, url }) => deleteChatConversation(request, locals, url)
};
