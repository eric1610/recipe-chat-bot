import { createHash, timingSafeEqual } from 'node:crypto';

const headerSafeSecret = /^[\x21-\x7e]{32,}$/;

export function isCronSecretConfigured(secret: string | undefined): secret is string {
	return Boolean(secret && headerSafeSecret.test(secret));
}

export function isCronAuthorizationValid(
	authorization: string | null,
	secret: string
): boolean {
	const actualDigest = createHash('sha256').update(authorization ?? '').digest();
	const expectedDigest = createHash('sha256').update(`Bearer ${secret}`).digest();
	return timingSafeEqual(actualDigest, expectedDigest);
}
