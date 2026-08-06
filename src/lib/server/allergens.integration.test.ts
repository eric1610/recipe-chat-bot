import { afterAll, describe, expect, it } from 'vitest';
import { createNeonDatabase, type Database } from '$lib/server/db';
import { userAllergies, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	loadAllergenWarningTerms,
	loadUserAllergies,
	persistDeclaredAllergies,
	replaceUserAllergies
} from './allergens';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const integrationRequired = process.env.REQUIRE_DATABASE_INTEGRATION === 'true';

if (integrationRequired && !testDatabaseUrl) {
	throw new Error('TEST_DATABASE_URL is required for the database integration suite.');
}
if (testDatabaseUrl) {
	const testUrl = new URL(testDatabaseUrl);
	if (!testUrl.pathname.toLowerCase().includes('test')) {
		throw new Error('TEST_DATABASE_URL must name an isolated database containing "test".');
	}
	if (process.env.DATABASE_URL) {
		const runtimeUrl = new URL(process.env.DATABASE_URL);
		const testIdentity = `${testUrl.hostname}:${testUrl.port || '5432'}${testUrl.pathname}`;
		const runtimeIdentity = `${runtimeUrl.hostname}:${runtimeUrl.port || '5432'}${runtimeUrl.pathname}`;
		if (testIdentity === runtimeIdentity) {
			throw new Error('TEST_DATABASE_URL must never identify the DATABASE_URL database.');
		}
	}
}

const describeDatabase = testDatabaseUrl ? describe : describe.skip;

describeDatabase('account-scoped allergy persistence with PostgreSQL', () => {
	const database = testDatabaseUrl ? createNeonDatabase(testDatabaseUrl) : undefined;

	afterAll(async () => {
		await database?.$client.end();
	});

	it('canonicalizes declarations, replaces settings values, and cascades account deletion', async () => {
		const db = database as Database;
		const userId = `allergy-test-${crypto.randomUUID()}`;

		try {
			await db.insert(users).values({ id: userId, email: `${userId}@example.test` });
			await expect(
				persistDeclaredAllergies(
					db,
					userId,
					"I'm allergic to peanut and shellfish. My friend is allergic to milk."
				)
			).resolves.toEqual(['Peanuts', 'Crustaceans and molluscs']);
			await expect(loadUserAllergies(db, userId)).resolves.toEqual([
				'Crustaceans and molluscs',
				'Peanuts'
			]);

			const warningTerms = await loadAllergenWarningTerms(db, userId);
			expect(warningTerms).toEqual(expect.arrayContaining(['peanut', 'shellfish', 'mustard']));

			await replaceUserAllergies(db, userId, ['sesame', 'strawberries']);
			await expect(loadUserAllergies(db, userId)).resolves.toEqual([
				'Sesame seeds',
				'strawberries'
			]);
		} finally {
			await db.delete(users).where(eq(users.id, userId));
		}

		const remaining = await db
			.select({ normalizedName: userAllergies.normalizedName })
			.from(userAllergies)
			.where(eq(userAllergies.userId, userId));
		expect(remaining).toEqual([]);
	});
});
