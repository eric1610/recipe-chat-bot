import { deleteChatConversation, loadChatData } from '$lib/server/chat/page';
import { isUuid } from '$lib/server/security/request';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		redirect(303, `/signin?redirectTo=${encodeURIComponent(url.pathname)}`);
	}
	if (!isUuid(params.conversationId)) error(404, 'Conversation not found.');
	return {
		session,
		...(await loadChatData(session.user.id, params.conversationId))
	};
};

export const actions: Actions = {
	deleteConversation: ({ request, locals, params, url }) =>
		deleteChatConversation(request, locals, url, params.conversationId)
};
