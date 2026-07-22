import { env } from '$env/dynamic/private';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

function createNeonDatabase(url: string) {
	return drizzle({ client: neon(url), schema });
}

export type Database = ReturnType<typeof createNeonDatabase>;

let database: Database | undefined;

function createDatabase() {
	if (!env.DATABASE_URL) {
		throw new Error('DATABASE_URL is required to use authentication and cloud history.');
	}

	return createNeonDatabase(env.DATABASE_URL);
}

export function getDatabase() {
	database ??= createDatabase();
	return database;
}
