import { createHash, timingSafeEqual } from 'node:crypto';

const headerSafeSecret = /^[\x21-\x7e]{32,}$/;

export function isBearerSecretConfigured(secret: string | undefined): secret is string {
	return Boolean(secret && headerSafeSecret.test(secret));
}

export function isBearerAuthorizationValid(
	authorization: string | null,
	secret: string
): boolean {
	const actualDigest = createHash('sha256').update(authorization ?? '').digest();
	const expectedDigest = createHash('sha256').update(`Bearer ${secret}`).digest();
	return timingSafeEqual(actualDigest, expectedDigest);
}
