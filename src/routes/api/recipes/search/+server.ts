import { env } from '$env/dynamic/private';
import { getDatabase, type Database } from '$lib/server/db';
import type { StoredRecipeCandidate } from '$lib/recipes/types';
import { parseChatGenerationRequest } from '$lib/server/ai/request';
import { readSameOriginJson } from '$lib/server/security/request';
import { detectRecipeLookupIntent } from '$lib/server/recipes/intent';
import { discoverRecipeCandidates, findCachedRecipeCandidates } from '$lib/server/recipes/retrieval';
import { persistRecipeSearch } from '$lib/server/recipes/persistence';
import { reserveRecipeSearch } from '$lib/server/recipes/quota';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface RecipeSearchDependencies {
	getConfig: () => { enabled: boolean; apiKey?: string; sharedLimit?: string };
	getDatabase: () => Database;
	findCached: (database: Database, queryKey: string) => Promise<StoredRecipeCandidate[]>;
	reserve: (database: Database, userId: string, sharedLimit?: string) => Promise<{ allowed: boolean; retryAfter: number }>;
	discover: (database: Database, input: {
		queryText: string;
		queryKey: string;
		apiKey: string;
		cachedCandidates?: StoredRecipeCandidate[];
	}) => Promise<StoredRecipeCandidate[]>;
	persist: typeof persistRecipeSearch;
}

export function _createRecipeSearchHandler(dependencies: RecipeSearchDependencies): RequestHandler {
	return async ({ request, locals, url }) => {
	const session = await locals.auth();
	if (!session?.user?.id) error(401, 'Sign in to search for recipe sources.');
	const body = await readSameOriginJson(request, url, 16_384);
	let payload;
	try {
		payload = parseChatGenerationRequest(body);
	} catch (cause) {
		error(400, cause instanceof Error ? cause.message : 'The recipe search request is invalid.');
	}
	if ('recipeSelection' in payload) error(400, 'The recipe search request is invalid.');
	const intent = detectRecipeLookupIntent(payload.message.content);
	const config = dependencies.getConfig();
	if (!intent || !config.enabled) {
		return Response.json({ kind: 'generate' }, { headers: { 'cache-control': 'private, no-store' } });
	}
	const database = dependencies.getDatabase();
	let candidates: StoredRecipeCandidate[];
	try {
		candidates = await dependencies.findCached(database, intent.queryKey);
		if (candidates.length < 3) {
			if (!config.apiKey) error(503, 'Recipe source search is not configured yet.');
			const quota = await dependencies.reserve(database, session.user.id, config.sharedLimit);
			if (!quota.allowed) {
				return new Response('Recipe source search is temporarily limited. Try again later.', {
					status: 429,
					headers: { 'retry-after': String(quota.retryAfter), 'cache-control': 'private, no-store' }
				});
			}
			candidates = await dependencies.discover(database, {
				...intent,
				apiKey: config.apiKey,
				cachedCandidates: candidates
			});
		}
	} catch {
		error(503, 'Recipe source search is temporarily unavailable.');
	}
	if (candidates.length === 0) error(404, 'No recipe sources matched that request. Try a more specific dish or cuisine.');

	const persisted = await dependencies.persist(database, {
		userId: session.user.id,
		conversationId: payload.conversationId,
		userMessageId: payload.message.id,
		content: payload.message.content,
		queryKey: intent.queryKey,
		queryText: intent.queryText,
		candidates
	});
	return Response.json({
		kind: 'choose',
		...persisted,
		candidates: candidates.map(({ facts: _facts, sourceKey: _sourceKey, ...candidate }) => candidate)
	}, { headers: { 'cache-control': 'private, no-store' } });
	};
}

export const POST: RequestHandler = _createRecipeSearchHandler({
	getConfig: () => ({
		enabled: env.RECIPE_WEB_SEARCH_ENABLED === 'true',
		apiKey: env.BRAVE_SEARCH_API_KEY,
		sharedLimit: env.RECIPE_SEARCH_DAILY_CAP
	}),
	getDatabase,
	findCached: findCachedRecipeCandidates,
	reserve: reserveRecipeSearch,
	discover: discoverRecipeCandidates,
	persist: persistRecipeSearch
});
