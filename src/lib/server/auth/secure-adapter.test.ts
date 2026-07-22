import type { Adapter, AdapterAccount, AdapterSession, AdapterUser } from '@auth/sveltekit/adapters';
import { describe, expect, it, vi } from 'vitest';
import { hashSessionToken, removeProviderTokens, secureAuthAdapter } from './secure-adapter';

const secret = 'test-secret-with-enough-entropy';
const user: AdapterUser = {
	id: 'user-1',
	name: 'Cook',
	email: 'cook@example.com',
	emailVerified: null
};

describe('secure Auth.js adapter', () => {
	it('hashes session tokens before database operations', async () => {
		const createSession = vi.fn(async (session: AdapterSession) => session);
		const getSessionAndUser = vi.fn(async (sessionToken: string) => ({
			session: { sessionToken, userId: user.id, expires: new Date('2030-01-01') },
			user
		}));
		const adapter = secureAuthAdapter({ createSession, getSessionAndUser } satisfies Adapter, secret);

		const created = await adapter.createSession?.({
			sessionToken: 'raw-session-token',
			userId: user.id,
			expires: new Date('2030-01-01')
		});
		const loaded = await adapter.getSessionAndUser?.('raw-session-token');

		expect(createSession).toHaveBeenCalledWith(
			expect.objectContaining({ sessionToken: hashSessionToken('raw-session-token', secret) })
		);
		expect(getSessionAndUser).toHaveBeenCalledWith(hashSessionToken('raw-session-token', secret));
		expect(created?.sessionToken).toBe('raw-session-token');
		expect(loaded?.session.sessionToken).toBe('raw-session-token');
	});

	it('removes reusable provider token material before linking an account', async () => {
		const account: AdapterAccount = {
			userId: user.id,
			type: 'oauth',
			provider: 'github',
			providerAccountId: 'provider-user',
			access_token: 'access',
			refresh_token: 'refresh',
			id_token: 'identity',
			session_state: 'state'
		};

		expect(removeProviderTokens(account)).toEqual({
			userId: user.id,
			type: 'oauth',
			provider: 'github',
			providerAccountId: 'provider-user'
		});
	});
});
