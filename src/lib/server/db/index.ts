import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

export function createNeonDatabase(url: string) {
	// Drizzle's neon-http driver cannot run the interactive transactions used by chat and imports.
	return drizzle({
		connection: {
			connectionString: url,
			max: 2,
			idleTimeoutMillis: 10_000,
			connectionTimeoutMillis: 10_000
		},
		schema
	});
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
