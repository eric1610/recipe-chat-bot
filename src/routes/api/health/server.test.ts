import { describe, expect, it, vi } from 'vitest';
import type { DetailedHealth } from '$lib/server/health';
import { _createHealthHandler } from './+server';

const secret = 'h'.repeat(64);
const healthy: DetailedHealth = {
	status: 'ok',
	checkedAt: '2030-05-02T10:00:00.000Z',
	checks: {
		application: { status: 'ok', code: 'responding' },
		database: { status: 'ok', code: 'reachable' },
		aiProvider: { status: 'ok', code: 'recent_success' }
	}
};

function event(authorization?: string) {
	return {
		request: new Request('https://example.test/api/health', {
			headers: authorization ? { authorization } : undefined
		}),
		locals: { requestId: 'request-123' }
	} as Parameters<ReturnType<typeof _createHealthHandler>>[0];
}

function handler(health: DetailedHealth, configuredSecret: string | null = secret) {
	return _createHealthHandler({
		getSecret: () => configuredSecret ?? undefined,
		inspect: vi.fn().mockResolvedValue(health),
		logDegraded: vi.fn()
	});
}

describe('health endpoint', () => {
	it('returns only the public aggregate status without authorization', async () => {
		const response = await handler(healthy)(event());
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ status: 'ok' });
	});

	it('returns component details for valid bearer authorization', async () => {
		const response = await handler(healthy)(event(`Bearer ${secret}`));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(healthy);
	});

	it.each([
		['invalid authorization', secret, `Bearer ${'x'.repeat(64)}`],
		['missing configuration', null, `Bearer ${secret}`],
		['malformed authorization', secret, secret]
	])('rejects %s', async (_name, configuredSecret, authorization) => {
		const response = await handler(healthy, configuredSecret)(event(authorization));
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Unauthorized.' });
	});

	it('reports degradation without failing liveness', async () => {
		const degraded: DetailedHealth = {
			...healthy,
			status: 'degraded',
			checks: {
				...healthy.checks,
				aiProvider: { status: 'degraded', code: 'recent_provider_failure' }
			}
		};
		const logDegraded = vi.fn();
		const inspect = vi.fn().mockResolvedValue(degraded);
		const endpoint = _createHealthHandler({
			getSecret: () => secret,
			inspect,
			logDegraded
		});
		const response = await endpoint(event());
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: 'degraded' });
		expect(logDegraded).toHaveBeenCalledWith(degraded, 'request-123', expect.any(Number));
	});

	it('returns 503 when a required component is unavailable', async () => {
		const unavailable: DetailedHealth = {
			...healthy,
			status: 'unavailable',
			checks: {
				...healthy.checks,
				database: { status: 'unavailable', code: 'unreachable' },
				aiProvider: { status: 'unavailable', code: 'database_unavailable' }
			}
		};
		const response = await handler(unavailable)(event());
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ status: 'unavailable' });
	});
});
