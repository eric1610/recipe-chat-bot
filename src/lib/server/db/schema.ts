import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid
} from 'drizzle-orm/pg-core';
import type { CookingSkill, MessageRole } from '$lib/chat/types';

export const users = pgTable('user', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name'),
	email: text('email').unique(),
	emailVerified: timestamp('emailVerified', { mode: 'date' }),
	image: text('image')
});

export const accounts = pgTable(
	'account',
	{
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').$type<'oidc' | 'oauth' | 'email' | 'credentials' | 'webauthn'>().notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('providerAccountId').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state')
	},
	(account) => [
		primaryKey({ columns: [account.provider, account.providerAccountId] }),
		index('account_user_id_idx').on(account.userId)
	]
);

export const sessions = pgTable(
	'session',
	{
		sessionToken: text('sessionToken').primaryKey(),
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expires: timestamp('expires', { mode: 'date' }).notNull()
	},
	(session) => [index('session_user_id_idx').on(session.userId)]
);

export const verificationTokens = pgTable(
	'verificationToken',
	{
		identifier: text('identifier').notNull(),
		token: text('token').notNull(),
		expires: timestamp('expires', { mode: 'date' }).notNull()
	},
	(token) => [primaryKey({ columns: [token.identifier, token.token] })]
);

export const authenticators = pgTable(
	'authenticator',
	{
		credentialID: text('credentialID').notNull().unique(),
		userId: text('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		providerAccountId: text('providerAccountId').notNull(),
		credentialPublicKey: text('credentialPublicKey').notNull(),
		counter: integer('counter').notNull(),
		credentialDeviceType: text('credentialDeviceType').notNull(),
		credentialBackedUp: boolean('credentialBackedUp').notNull(),
		transports: text('transports')
	},
	(authenticator) => [primaryKey({ columns: [authenticator.userId, authenticator.credentialID] })]
);

export const userPreferences = pgTable('user_preferences', {
	userId: text('user_id')
		.primaryKey()
		.references(() => users.id, { onDelete: 'cascade' }),
	diets: jsonb('diets').$type<string[]>().notNull().default([]),
	allergies: jsonb('allergies').$type<string[]>().notNull().default([]),
	dislikedIngredients: jsonb('disliked_ingredients').$type<string[]>().notNull().default([]),
	preferredCuisines: jsonb('preferred_cuisines').$type<string[]>().notNull().default([]),
	cookingSkill: text('cooking_skill').$type<CookingSkill>(),
	householdSize: integer('household_size'),
	notes: text('notes').notNull().default(''),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const conversations = pgTable(
	'conversations',
	{
		id: uuid('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
		archivedAt: timestamp('archived_at', { withTimezone: true })
	},
	(conversation) => [
		index('conversations_user_updated_idx').on(conversation.userId, conversation.updatedAt)
	]
);

export const messages = pgTable(
	'messages',
	{
		id: uuid('id').primaryKey(),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		role: text('role').$type<MessageRole>().notNull(),
		content: text('content').notNull(),
		position: integer('position').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull()
	},
	(message) => [
		index('messages_conversation_position_idx').on(message.conversationId, message.position)
	]
);

export const authSchema = {
	usersTable: users,
	accountsTable: accounts,
	sessionsTable: sessions,
	verificationTokensTable: verificationTokens,
	authenticatorsTable: authenticators
};
