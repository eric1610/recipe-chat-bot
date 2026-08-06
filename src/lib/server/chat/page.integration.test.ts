import { afterAll, describe, expect, it } from 'vitest';
import { createNeonDatabase, type Database } from '$lib/server/db';
import { conversations, messages, userAllergies, userPreferences, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { loadUserPreferences } from '$lib/server/ai/preferences';
import { loadChatData } from './page';

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

describeDatabase('backend-restored conversation pages', () => {
	const database = testDatabaseUrl ? createNeonDatabase(testDatabaseUrl) : undefined;

	afterAll(async () => {
		await database?.$client.end();
	});

	it('loads only owned conversations and restores the full ordered message chain', async () => {
		const db = database as Database;
		const ownerId = `chat-route-owner-${crypto.randomUUID()}`;
		const otherId = `chat-route-other-${crypto.randomUUID()}`;
		const ownedConversationId = crypto.randomUUID();
		const foreignConversationId = crypto.randomUUID();
		const now = new Date('2030-07-28T12:00:00.000Z');

		try {
			await db.insert(users).values([
				{ id: ownerId, email: `${ownerId}@example.test` },
				{ id: otherId, email: `${otherId}@example.test` }
			]);
			await db.insert(conversations).values([
				{
					id: ownedConversationId,
					userId: ownerId,
					title: 'Owned conversation',
					createdAt: now,
					updatedAt: now,
					archivedAt: null
				},
				{
					id: foreignConversationId,
					userId: otherId,
					title: 'Foreign conversation',
					createdAt: now,
					updatedAt: now,
					archivedAt: null
				}
			]);
			await db.insert(messages).values([
				{
					id: crypto.randomUUID(),
					conversationId: ownedConversationId,
					role: 'assistant',
					content: 'Second message',
					position: 1,
					createdAt: new Date(now.getTime() + 1_000)
				},
				{
					id: crypto.randomUUID(),
					conversationId: ownedConversationId,
					role: 'user',
					content: 'First message',
					position: 0,
					createdAt: now
				}
			]);

			const result = await loadChatData(ownerId, ownedConversationId, db);
			expect(result.conversations.map(({ id }) => id)).toEqual([ownedConversationId]);
			expect(result.currentConversation?.id).toBe(ownedConversationId);
			expect(result.messages.map(({ content }) => content)).toEqual([
				'First message',
				'Second message'
			]);

			await expect(loadChatData(ownerId, foreignConversationId, db)).rejects.toMatchObject({
				status: 404,
				body: { message: 'Conversation not found.' }
			});
		} finally {
			await db.delete(users).where(eq(users.id, ownerId));
			await db.delete(users).where(eq(users.id, otherId));
		}
	});

	it('loads cooking preferences only for the authenticated user ID', async () => {
		const db = database as Database;
		const ownerId = `preference-owner-${crypto.randomUUID()}`;
		const otherId = `preference-other-${crypto.randomUUID()}`;

		try {
			await db.insert(users).values([
				{ id: ownerId, email: `${ownerId}@example.test` },
				{ id: otherId, email: `${otherId}@example.test` }
			]);
			await db.insert(userPreferences).values([
				{ userId: ownerId, notes: 'Owner profile' },
				{ userId: otherId, notes: 'Other profile' }
			]);
			await db.insert(userAllergies).values([
				{
					userId: ownerId,
					normalizedName: 'peanuts',
					displayName: 'Peanuts',
					catalogSlug: 'peanuts',
					source: 'settings'
				},
				{
					userId: otherId,
					normalizedName: 'crustaceans and molluscs',
					displayName: 'Crustaceans and molluscs',
					catalogSlug: 'crustaceans-molluscs',
					source: 'settings'
				}
			]);

			await expect(loadUserPreferences(db, ownerId)).resolves.toMatchObject({
				allergies: ['Peanuts'],
				notes: 'Owner profile'
			});
			await expect(loadUserPreferences(db, 'missing-user')).resolves.toBeNull();
		} finally {
			await db.delete(users).where(eq(users.id, ownerId));
			await db.delete(users).where(eq(users.id, otherId));
		}
	});
});
