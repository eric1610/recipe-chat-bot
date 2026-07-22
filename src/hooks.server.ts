import { sequence } from '@sveltejs/kit/hooks';
import { handle as authHandle } from './auth';
import { securityHeaders } from '$lib/server/security/headers';

export const handle = sequence(authHandle, securityHeaders);
