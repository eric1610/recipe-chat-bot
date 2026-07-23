import { APICallError } from 'ai';
import { getUtcQuotaWindow, parseRetryAfter } from './quota';

export interface ProviderFailure {
	code: 'provider_rate_limit' | 'provider_unavailable' | 'generation_failed';
	message: string;
	blockedUntil: Date | null;
}

function findApiCallError(value: unknown, seen = new Set<unknown>()): APICallError | null {
	if (value === null || value === undefined || seen.has(value)) return null;
	seen.add(value);
	if (APICallError.isInstance(value)) return value;
	if (value instanceof Error && value.cause) {
		const cause = findApiCallError(value.cause, seen);
		if (cause) return cause;
	}
	if (typeof value === 'object' && 'errors' in value && Array.isArray(value.errors)) {
		for (const nested of value.errors) {
			const error = findApiCallError(nested, seen);
			if (error) return error;
		}
	}
	return null;
}

export function classifyProviderFailure(error: unknown, now = new Date()): ProviderFailure {
	const apiError = findApiCallError(error);
	if (apiError?.statusCode === 429) {
		return {
			code: 'provider_rate_limit',
			message: "Today's AI request limit has been reached. Try again after the daily reset.",
			blockedUntil: parseRetryAfter(apiError.responseHeaders, now) ?? getUtcQuotaWindow(now).end
		};
	}
	if (apiError?.statusCode === 503 || apiError?.statusCode === 502 || apiError?.statusCode === 404) {
		return {
			code: 'provider_unavailable',
			message: 'No privacy-compatible free model is available right now. Please try again later.',
			blockedUntil: null
		};
	}
	return {
		code: 'generation_failed',
		message: 'The recipe assistant could not complete that response. Please try again.',
		blockedUntil: null
	};
}
