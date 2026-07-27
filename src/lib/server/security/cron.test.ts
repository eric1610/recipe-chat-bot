import { describe, expect, it } from 'vitest';
import { isCronAuthorizationValid, isCronSecretConfigured } from './cron';

const secret = 'a'.repeat(64);

describe('cron authorization', () => {
	it('requires a non-empty header-safe secret with at least 32 characters', () => {
		expect(isCronSecretConfigured(undefined)).toBe(false);
		expect(isCronSecretConfigured('')).toBe(false);
		expect(isCronSecretConfigured('short')).toBe(false);
		expect(isCronSecretConfigured(`valid-but-has-a-space ${'x'.repeat(32)}`)).toBe(false);
		expect(isCronSecretConfigured('x'.repeat(32))).toBe(true);
		expect(isCronSecretConfigured(secret)).toBe(true);
	});

	it('accepts only the exact bearer authorization value', () => {
		expect(isCronAuthorizationValid(`Bearer ${secret}`, secret)).toBe(true);
		expect(isCronAuthorizationValid(null, secret)).toBe(false);
		expect(isCronAuthorizationValid(secret, secret)).toBe(false);
		expect(isCronAuthorizationValid(`bearer ${secret}`, secret)).toBe(false);
		expect(isCronAuthorizationValid(`Bearer ${secret} extra`, secret)).toBe(false);
		expect(isCronAuthorizationValid(`Bearer ${'b'.repeat(64)}`, secret)).toBe(false);
	});
});
