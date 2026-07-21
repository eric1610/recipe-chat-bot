import { env } from '$env/dynamic/private';
import { getDatabase } from '$lib/server/db';
import { authSchema } from '$lib/server/db/schema';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { SvelteKitAuth } from '@auth/sveltekit';
import GitHub from '@auth/sveltekit/providers/github';
import Google from '@auth/sveltekit/providers/google';

export const { handle, signIn, signOut } = SvelteKitAuth(async () => ({
	adapter: DrizzleAdapter(getDatabase(), authSchema),
	providers: [Google, GitHub],
	secret: env.AUTH_SECRET,
	trustHost: true,
	session: { strategy: 'database' },
	pages: {
		signIn: '/signin',
		error: '/auth/error'
	},
	callbacks: {
		session({ session, user }) {
			session.user.id = user.id;
			return session;
		}
	}
}));
