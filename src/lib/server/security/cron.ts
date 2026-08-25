import {
	isBearerAuthorizationValid,
	isBearerSecretConfigured
} from './bearer';

export function isCronSecretConfigured(secret: string | undefined): secret is string {
	return isBearerSecretConfigured(secret);
}

export function isCronAuthorizationValid(
	authorization: string | null,
	secret: string
): boolean {
	return isBearerAuthorizationValid(authorization, secret);
}
