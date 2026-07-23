import { Pool } from '@neondatabase/serverless';
import { afterEach, describe, expect, it } from 'vitest';
import { createNeonDatabase } from './index';

describe('database connection', () => {
	const clients: Pool[] = [];

	afterEach(async () => {
		await Promise.all(clients.map((client) => client.end()));
		clients.length = 0;
	});

	it('uses the transaction-capable Neon Pool driver', () => {
		const database = createNeonDatabase(
			'postgresql://recipe_app:placeholder@example.invalid/recipe_chat_bot'
		);
		expect(database.$client).toBeInstanceOf(Pool);
		clients.push(database.$client);
	});
});
