import { env } from '$env/dynamic/private';
import { inspectSystemHealth, type DetailedHealth } from '$lib/server/health';
import { getDatabase } from '$lib/server/db';
import { logOperationalEvent } from '$lib/server/observability/log';
import {
	isBearerAuthorizationValid,
	isBearerSecretConfigured
} from '$lib/server/security/bearer';
import type { RequestHandler } from './$types';

interface HealthHandlerDependencies {
	getSecret: () => string | undefined;
	inspect: () => Promise<DetailedHealth>;
	logDegraded: (health: DetailedHealth, requestId: string, durationMs: number) => void;
}

function response(body: unknown, status: number): Response {
	return Response.json(body, {
		status,
		headers: { 'cache-control': 'no-store' }
	});
}

export function _createHealthHandler(dependencies: HealthHandlerDependencies): RequestHandler {
	return async ({ request, locals }) => {
		const authorization = request.headers.get('authorization');
		const detailed = authorization !== null;
		if (detailed) {
			const secret = dependencies.getSecret();
			if (!isBearerSecretConfigured(secret) || !isBearerAuthorizationValid(authorization, secret)) {
				return response({ error: 'Unauthorized.' }, 401);
			}
		}

		const startedAt = performance.now();
		const health = await dependencies.inspect();
		const durationMs = performance.now() - startedAt;
		if (health.status !== 'ok') {
			dependencies.logDegraded(health, locals.requestId, durationMs);
		}
		return response(
			detailed ? health : { status: health.status },
			health.status === 'unavailable' ? 503 : 200
		);
	};
}

export const GET: RequestHandler = _createHealthHandler({
	getSecret: () => env.HEALTH_CHECK_SECRET,
	inspect: () =>
		inspectSystemHealth(getDatabase(), {
			openRouterConfigured: Boolean(env.OPENROUTER_API_KEY)
		}),
	logDegraded: (health, requestId, durationMs) => {
		const databaseUnavailable = health.checks.database.status === 'unavailable';
		logOperationalEvent({
			level: health.status === 'unavailable' ? 'error' : 'warn',
			event: 'health.check_degraded',
			subsystem: databaseUnavailable ? 'database' : 'ai_provider',
			requestId,
			route: '/api/health',
			method: 'GET',
			status: health.status === 'unavailable' ? 503 : 200,
			code: databaseUnavailable
				? health.checks.database.code
				: health.checks.aiProvider.code,
			durationMs
		});
	}
});
