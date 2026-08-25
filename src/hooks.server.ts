import { sequence } from '@sveltejs/kit/hooks';
import type { HandleServerError } from '@sveltejs/kit';
import { handle as authHandle } from './auth';
import { securityHeaders } from '$lib/server/security/headers';
import { logOperationalEvent, safeErrorName } from '$lib/server/observability/log';
import { requestContext } from '$lib/server/observability/request';

export const handle = sequence(requestContext, securityHeaders, authHandle);

export const handleError: HandleServerError = ({ error, event, status }) => {
	logOperationalEvent({
		level: 'error',
		event: 'server.unhandled_error',
		subsystem: 'application',
		requestId: event.locals.requestId,
		route: event.route.id ?? 'unmatched',
		method: event.request.method,
		status,
		code: safeErrorName(error)
	});
	return {
		message: 'An unexpected error occurred.',
		requestId: event.locals.requestId
	};
};
