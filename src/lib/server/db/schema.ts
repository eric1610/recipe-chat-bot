import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import type { CookingSkill, MessageRole } from '$lib/chat/types';
import type { RecipeFacts, StoredRecipeCandidate } from '$lib/recipes/types';

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
	dislikedIngredients: jsonb('disliked_ingredients').$type<string[]>().notNull().default([]),
	preferredCuisines: jsonb('preferred_cuisines').$type<string[]>().notNull().default([]),
	cookingSkill: text('cooking_skill').$type<CookingSkill>(),
	householdSize: integer('household_size'),
	notes: text('notes').notNull().default(''),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const allergenCatalog = pgTable('allergen_catalog', {
	slug: text('slug').primaryKey(),
	name: text('name').notNull().unique(),
	aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
	jurisdiction: text('jurisdiction').notNull(),
	sourceUrl: text('source_url').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export type UserAllergySource = 'settings' | 'chat';

export const userAllergies = pgTable(
	'user_allergies',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		normalizedName: text('normalized_name').notNull(),
		displayName: text('display_name').notNull(),
		catalogSlug: text('catalog_slug').references(() => allergenCatalog.slug, {
			onDelete: 'set null'
		}),
		source: text('source').$type<UserAllergySource>().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(allergy) => [
		primaryKey({ columns: [allergy.userId, allergy.normalizedName] }),
		index('user_allergies_catalog_idx').on(allergy.catalogSlug)
	]
);

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
		uniqueIndex('messages_conversation_position_idx').on(message.conversationId, message.position)
	]
);

export type RecipeSourceStatus = 'approved' | 'blocked';

export const recipeSourcePolicies = pgTable('recipe_source_policies', {
	hostname: text('hostname').primaryKey(),
	status: text('status').$type<RecipeSourceStatus>().notNull(),
	allowedPathPrefixes: jsonb('allowed_path_prefixes').$type<string[]>().notNull().default([]),
	termsUrl: text('terms_url').notNull(),
	attributionName: text('attribution_name').notNull(),
	parser: text('parser').$type<'schema_recipe'>().notNull().default('schema_recipe'),
	reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull(),
	notes: text('notes').notNull().default(''),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const recipeSearches = pgTable(
	'recipe_searches',
	{
		id: uuid('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		conversationId: uuid('conversation_id')
			.notNull()
			.references(() => conversations.id, { onDelete: 'cascade' }),
		userMessageId: uuid('user_message_id')
			.notNull()
			.references(() => messages.id, { onDelete: 'cascade' }),
		assistantMessageId: uuid('assistant_message_id')
			.notNull()
			.references(() => messages.id, { onDelete: 'cascade' }),
		queryKey: text('query_key').notNull(),
		queryText: text('query_text').notNull(),
		candidates: jsonb('candidates').$type<StoredRecipeCandidate[]>().notNull().default([]),
		status: text('status').$type<'pending' | 'selected' | 'expired'>().notNull().default('pending'),
		selectedCandidateId: uuid('selected_candidate_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
	},
	(search) => [
		index('recipe_searches_user_conversation_idx').on(search.userId, search.conversationId),
		index('recipe_searches_expires_idx').on(search.expiresAt)
	]
);

export const recipeCache = pgTable(
	'recipe_cache',
	{
		sourceKey: text('source_key').primaryKey(),
		canonicalUrl: text('canonical_url').notNull().unique(),
		hostname: text('hostname')
			.notNull()
			.references(() => recipeSourcePolicies.hostname, { onDelete: 'cascade' }),
		queryKeys: jsonb('query_keys').$type<string[]>().notNull().default([]),
		sourceTitle: text('source_title').notNull(),
		normalizedFacts: jsonb('normalized_facts').$type<RecipeFacts>(),
		selectionCount: integer('selection_count').notNull().default(0),
		selectionWindowStart: timestamp('selection_window_start', { withTimezone: true }).notNull(),
		lastSelectedAt: timestamp('last_selected_at', { withTimezone: true }).notNull(),
		cachedAt: timestamp('cached_at', { withTimezone: true }),
		refreshAfter: timestamp('refresh_after', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(cache) => [
		index('recipe_cache_hostname_idx').on(cache.hostname),
		index('recipe_cache_refresh_idx').on(cache.refreshAfter),
		index('recipe_cache_last_selected_idx').on(cache.lastSelectedAt)
	]
);

export const recipeSearchQuotaWindows = pgTable('recipe_search_quota_windows', {
	windowStart: timestamp('window_start', { withTimezone: true }).primaryKey(),
	searchCount: integer('search_count').notNull().default(0),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const securityRateLimits = pgTable(
	'security_rate_limits',
	{
		key: text('key').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		action: text('action').notNull(),
		windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
		count: integer('count').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
	},
	(limit) => [index('security_rate_limits_expires_idx').on(limit.expiresAt)]
);

export type AiGenerationAttemptStatus =
	| 'reserved'
	| 'started'
	| 'completed'
	| 'failed'
	| 'cancelled'
	| 'provider_limited';

export const aiQuotaWindows = pgTable(
	'ai_quota_windows',
	{
		provider: text('provider').notNull(),
		windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
		attemptCount: integer('attempt_count').notNull().default(0),
		providerBlockedUntil: timestamp('provider_blocked_until', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(window) => [primaryKey({ columns: [window.provider, window.windowStart] })]
);

export const aiGenerationAttempts = pgTable(
	'ai_generation_attempts',
	{
		id: uuid('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		conversationId: uuid('conversation_id').notNull(),
		userMessageId: uuid('user_message_id').notNull(),
		assistantMessageId: uuid('assistant_message_id'),
		provider: text('provider').notNull(),
		model: text('model').notNull(),
		windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
		status: text('status').$type<AiGenerationAttemptStatus>().notNull(),
		inputTokens: integer('input_tokens'),
		outputTokens: integer('output_tokens'),
		totalTokens: integer('total_tokens'),
		errorCode: text('error_code'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true })
	},
	(attempt) => [
		uniqueIndex('ai_generation_attempts_user_message_idx').on(attempt.userMessageId),
		index('ai_generation_attempts_user_window_idx').on(attempt.userId, attempt.windowStart),
		index('ai_generation_attempts_created_idx').on(attempt.createdAt)
	]
);

export const authSchema = {
	usersTable: users,
	accountsTable: accounts,
	sessionsTable: sessions,
	verificationTokensTable: verificationTokens,
	authenticatorsTable: authenticators
};
