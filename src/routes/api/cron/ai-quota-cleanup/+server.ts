import { env } from '$env/dynamic/private';
import { cleanupAiQuota, type AiCleanupResult } from '$lib/server/ai/cleanup';
import { getDatabase, type Database } from '$lib/server/db';
import {
	isCronAuthorizationValid,
	isCronSecretConfigured
} from '$lib/server/security/cron';
import type { RequestHandler } from './$types';

interface CronCleanupDependencies {
	getSecret: () => string | undefined;
	getDatabase: () => Database;
	cleanup: (database: Database) => Promise<AiCleanupResult>;
	logFailure: () => void;
}

function json(body: unknown, status: number): Response {
	return Response.json(body, {
		status,
		headers: { 'cache-control': 'private, no-store' }
	});
}

export function _createCronCleanupHandler(dependencies: CronCleanupDependencies): RequestHandler {
	return async ({ request }) => {
		const secret = dependencies.getSecret();
		if (!isCronSecretConfigured(secret)) {
			return json({ ok: false, error: 'Cron cleanup is not configured.' }, 503);
		}
		if (!isCronAuthorizationValid(request.headers.get('authorization'), secret)) {
			return json({ ok: false, error: 'Unauthorized.' }, 401);
		}

		try {
			const result = await dependencies.cleanup(dependencies.getDatabase());
			return json({ ok: true, ...result }, 200);
		} catch {
			dependencies.logFailure();
			return json({ ok: false, error: 'Quota cleanup failed.' }, 500);
		}
	};
}

export const GET: RequestHandler = _createCronCleanupHandler({
	getSecret: () => env.CRON_SECRET,
	getDatabase,
	cleanup: cleanupAiQuota,
	logFailure: () => console.error('AI quota cleanup failed.')
});
