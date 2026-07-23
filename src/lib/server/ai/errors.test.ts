import { APICallError } from 'ai';
import { describe, expect, it } from 'vitest';
import { classifyProviderFailure } from './errors';

const now = new Date('2030-05-02T17:30:00.000Z');

function apiError(statusCode: number, responseHeaders?: Record<string, string>) {
	return new APICallError({
		message: 'provider detail that must not reach the browser',
		url: 'https://openrouter.ai/api/v1/chat/completions',
		requestBodyValues: { secret: 'not exposed' },
		statusCode,
		responseHeaders
	});
}

describe('provider error handling', () => {
	it('turns a provider 429 into a sanitized daily-limit state', () => {
		const failure = classifyProviderFailure(apiError(429, { 'retry-after': '90' }), now);
		expect(failure).toEqual({
			code: 'provider_rate_limit',
			message: "Today's AI request limit has been reached. Try again after the daily reset.",
			blockedUntil: new Date('2030-05-02T17:31:30.000Z')
		});
	});

	it('falls back to the UTC window boundary when 429 has no retry header', () => {
		expect(classifyProviderFailure(apiError(429), now).blockedUntil).toEqual(
			new Date('2030-05-03T00:00:00.000Z')
		);
	});

	it('does not expose provider response details for unavailable or unknown failures', () => {
		expect(classifyProviderFailure(apiError(503), now).message).toContain('privacy-compatible');
		expect(classifyProviderFailure(new Error('secret provider payload'), now)).toEqual({
			code: 'generation_failed',
			message: 'The recipe assistant could not complete that response. Please try again.',
			blockedUntil: null
		});
	});
});
