import { describe, expect, it } from 'vitest';
import { isUuid, readSameOriginFormData, readSameOriginJson } from './request';

const url = new URL('https://recipe.example/api/chat');

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

describe('same-origin form guard', () => {
	function formRequest(body: string, headers: Record<string, string> = {}) {
		return new Request('https://recipe.example/settings', {
			method: 'POST',
			body,
			headers: {
				origin: 'https://recipe.example',
				'content-type': 'application/x-www-form-urlencoded',
				...headers
			}
		});
	}

	it('accepts a bounded same-origin form', async () => {
		const formData = await readSameOriginFormData(
			formRequest('diets=vegetarian&householdSize=2'),
			new URL('https://recipe.example/settings')
		);
		expect(formData.get('diets')).toBe('vegetarian');
		expect(formData.get('householdSize')).toBe('2');
	});

	it('rejects missing or cross-origin origins and cross-site metadata', async () => {
		const destination = new URL('https://recipe.example/settings');
		await expect(
			readSameOriginFormData(formRequest('notes=x', { origin: 'https://attacker.example' }), destination)
		).rejects.toMatchObject({ status: 403 });
		await expect(
			readSameOriginFormData(formRequest('notes=x', { 'sec-fetch-site': 'cross-site' }), destination)
		).rejects.toMatchObject({ status: 403 });
		const withoutOrigin = new Request(destination, {
			method: 'POST',
			body: 'notes=x',
			headers: { 'content-type': 'application/x-www-form-urlencoded' }
		});
		await expect(readSameOriginFormData(withoutOrigin, destination)).rejects.toMatchObject({
			status: 403
		});
	});

	it('rejects unsupported and oversized form bodies before parsing', async () => {
		const destination = new URL('https://recipe.example/settings');
		await expect(
			readSameOriginFormData(formRequest('{}', { 'content-type': 'application/json' }), destination)
		).rejects.toMatchObject({ status: 415 });
		await expect(
			readSameOriginFormData(formRequest('notes=123456'), destination, 5)
		).rejects.toMatchObject({ status: 413 });
	});
});
