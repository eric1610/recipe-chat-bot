import type { Handle } from '@sveltejs/kit';

export const requestContext: Handle = async ({ event, resolve }) => {
	event.locals.requestId = crypto.randomUUID();
	const response = await resolve(event);
	const headers = new Headers(response.headers);
	headers.set('x-request-id', event.locals.requestId);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};
