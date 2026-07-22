import { error } from '@sveltejs/kit';

const jsonContentType = /^application\/json(?:\s*;|$)/i;

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
	);
}

export async function readSameOriginJson(
	request: Request,
	url: URL,
	maxBytes = 1_048_576
): Promise<unknown> {
	const origin = request.headers.get('origin');
	if (origin !== url.origin) error(403, 'Cross-origin mutations are not allowed.');

	const fetchSite = request.headers.get('sec-fetch-site');
	if (fetchSite && fetchSite !== 'same-origin') error(403, 'Cross-site mutations are not allowed.');

	const contentType = request.headers.get('content-type') ?? '';
	if (!jsonContentType.test(contentType)) error(415, 'Content-Type must be application/json.');

	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > maxBytes) error(413, 'The request payload is too large.');

	const body = await request.text();
	if (new TextEncoder().encode(body).byteLength > maxBytes) error(413, 'The request payload is too large.');

	try {
		return JSON.parse(body) as unknown;
	} catch {
		error(400, 'The JSON payload is invalid.');
	}
}
