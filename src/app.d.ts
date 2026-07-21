import type { DefaultSession } from '@auth/sveltekit';

declare global {
	namespace App {
		interface Locals {
			auth: () => Promise<import('@auth/sveltekit').Session | null>;
		}
	}
}

declare module '@auth/sveltekit' {
	interface Session {
		user: {
			id: string;
		} & DefaultSession['user'];
	}
}

export {};
