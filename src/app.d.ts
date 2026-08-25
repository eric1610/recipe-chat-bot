import type { DefaultSession } from '@auth/sveltekit';

declare global {
	namespace App {
		interface Error {
			message: string;
			requestId?: string;
		}

		interface Locals {
			auth: () => Promise<import('@auth/sveltekit').Session | null>;
			requestId: string;
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
