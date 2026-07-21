import { env } from '$env/dynamic/private';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let database: ReturnType<typeof createDatabase> | undefined;

function createDatabase() {
	if (!env.DATABASE_URL) {
		throw new Error('DATABASE_URL is required to use authentication and cloud history.');
	}

	return drizzle({ client: neon(env.DATABASE_URL), schema });
}

export function getDatabase() {
	database ??= createDatabase();
	return database;
}
