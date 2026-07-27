import type { Handle } from '@sveltejs/kit';

const privateRoute = /^(?:\/auth(?:\/|$)|\/signin(?:\/|$)|\/signout(?:\/|$)|\/chat(?:\/|$)|\/settings(?:\/|$)|\/api\/(?:ai|chat|conversations|cron)(?:\/|$))/;

export function isPrivateRoute(pathname: string): boolean {
	return privateRoute.test(pathname);
}

export const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const headers = new Headers(response.headers);
	headers.set('x-content-type-options', 'nosniff');
	headers.set('x-frame-options', 'DENY');
	headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	headers.set('cross-origin-opener-policy', 'same-origin');
	headers.set(
		'permissions-policy',
		'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
	);
	if (isPrivateRoute(event.url.pathname)) {
		headers.set('cache-control', 'private, no-store');
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};
