import { createHmac } from 'node:crypto';
import type { Adapter, AdapterAccount, AdapterSession } from '@auth/sveltekit/adapters';

const tokenPrefix = 'hmac-sha256:';

export function hashSessionToken(token: string, secret: string): string {
	if (!secret) throw new Error('AUTH_SECRET is required to protect database sessions.');
	return `${tokenPrefix}${createHmac('sha256', secret).update(token).digest('hex')}`;
}

export function removeProviderTokens(account: AdapterAccount): AdapterAccount {
	const {
		access_token: _accessToken,
		refresh_token: _refreshToken,
		id_token: _idToken,
		session_state: _sessionState,
		...safeAccount
	} = account;
	return safeAccount;
}

function required<T extends (...args: never[]) => unknown>(method: T | undefined, name: string): T {
	if (!method) throw new Error(`Auth adapter method ${name} is required.`);
	return method;
}

export function secureAuthAdapter(adapter: Adapter, secret: string): Adapter {
	return {
		...adapter,
		async linkAccount(account) {
			await required(adapter.linkAccount, 'linkAccount')(removeProviderTokens(account));
		},
		async createSession(session) {
			const stored = await required(adapter.createSession, 'createSession')({
				...session,
				sessionToken: hashSessionToken(session.sessionToken, secret)
			});
			return { ...stored, sessionToken: session.sessionToken };
		},
		async getSessionAndUser(sessionToken) {
			const result = await required(adapter.getSessionAndUser, 'getSessionAndUser')(
				hashSessionToken(sessionToken, secret)
			);
			if (!result) return null;
			return {
				...result,
				session: { ...result.session, sessionToken }
			};
		},
		async updateSession(session) {
			const stored = await required(adapter.updateSession, 'updateSession')({
				...session,
				sessionToken: hashSessionToken(session.sessionToken, secret)
			});
			return stored ? { ...stored, sessionToken: session.sessionToken } : null;
		},
		async deleteSession(sessionToken) {
			return required(adapter.deleteSession, 'deleteSession')(
				hashSessionToken(sessionToken, secret)
			) as Promise<AdapterSession | null | undefined>;
		}
	};
}
