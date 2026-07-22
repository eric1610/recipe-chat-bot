import { describe, expect, it } from 'vitest';
import { isUuid, readSameOriginJson } from './request';

const url = new URL('https://recipe.example/api/conversations');

function request(body: string, headers: Record<string, string> = {}) {
	return new Request(url, {
		method: 'POST',
		body,
		headers: {
			origin: url.origin,
			'content-type': 'application/json',
			...headers
		}
	});
}

describe('same-origin JSON guard', () => {
	it('accepts a bounded same-origin JSON request', async () => {
		await expect(readSameOriginJson(request('{"ok":true}'), url)).resolves.toEqual({ ok: true });
	});

	it('rejects missing and cross-origin origins', async () => {
		await expect(
			readSameOriginJson(request('{}', { origin: 'https://attacker.example' }), url)
		).rejects.toMatchObject({ status: 403 });
		const withoutOrigin = new Request(url, {
			method: 'POST',
			body: '{}',
			headers: { 'content-type': 'application/json' }
		});
		await expect(readSameOriginJson(withoutOrigin, url)).rejects.toMatchObject({ status: 403 });
	});

	it('rejects non-JSON and oversized requests', async () => {
		await expect(
			readSameOriginJson(request('{}', { 'content-type': 'text/plain' }), url)
		).rejects.toMatchObject({ status: 415 });
		await expect(readSameOriginJson(request('123456'), url, 5)).rejects.toMatchObject({ status: 413 });
	});

	it('validates UUID values', () => {
		expect(isUuid('018f47a2-2d8e-7a15-8f7e-0123456789ab')).toBe(true);
		expect(isUuid('not-a-uuid')).toBe(false);
	});
});
