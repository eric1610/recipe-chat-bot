import { describe, expect, it } from 'vitest';
import { requestContext } from './request';

describe('request correlation', () => {
	it('assigns a request id to locals and the response', async () => {
		const event = { locals: {} } as Parameters<typeof requestContext>[0]['event'];
		const response = await requestContext({
			event,
			resolve: async () => new Response('ok')
		} as Parameters<typeof requestContext>[0]);
		expect(event.locals.requestId).toMatch(/^[0-9a-f-]{36}$/);
		expect(response.headers.get('x-request-id')).toBe(event.locals.requestId);
		expect(await response.text()).toBe('ok');
	});
});
