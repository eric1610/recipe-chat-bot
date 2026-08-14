import { createHash } from 'node:crypto';
import type { StoredRecipeCandidate } from '$lib/recipes/types';
import type { Database } from '$lib/server/db';
import { recipeCache, recipeSourcePolicies } from '$lib/server/db/schema';
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import {
	fetchWikibooksRecipe,
	searchWikibooks,
	WIKIBOOKS_HOST,
	WIKIBOOKS_LICENSE_NAME,
	WIKIBOOKS_LICENSE_URL
} from './wikibooks';

export function sourceKey(url: string): string {
	return createHash('sha256').update(url).digest('hex');
}

function policyAllows(policy: { allowedPathPrefixes: string[] }, url: URL): boolean {
	return policy.allowedPathPrefixes.length === 0 || policy.allowedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix));
}

export async function findCachedRecipeCandidates(
	database: Database,
	queryKey: string,
	now = new Date()
): Promise<StoredRecipeCandidate[]> {
	const records = await database
		.select({
			url: recipeCache.canonicalUrl,
			title: recipeCache.sourceTitle,
			hostname: recipeCache.hostname,
			facts: recipeCache.normalizedFacts
		})
		.from(recipeCache)
		.innerJoin(recipeSourcePolicies, eq(recipeSourcePolicies.hostname, recipeCache.hostname))
		.where(and(
			eq(recipeSourcePolicies.status, 'approved'),
			isNotNull(recipeCache.normalizedFacts),
			gt(recipeCache.refreshAfter, now),
			sql`${recipeCache.queryKeys} @> ${JSON.stringify([queryKey])}::jsonb`
		))
		.limit(3);
	return records.flatMap((record) => record.facts ? [{
		id: crypto.randomUUID(),
		title: record.title,
		domain: record.hostname,
		url: record.url,
		snippet: 'Previously selected recipe source.',
		approved: true,
		sourceKey: sourceKey(record.url),
		facts: record.facts,
		...(record.hostname === WIKIBOOKS_HOST ? {
			licenseName: WIKIBOOKS_LICENSE_NAME,
			licenseUrl: WIKIBOOKS_LICENSE_URL,
			adapted: true
		} : {})
	}] : []);
}

export async function discoverRecipeCandidates(
	database: Database,
	input: {
		queryText: string;
		queryKey: string;
		now?: Date;
		cachedCandidates?: StoredRecipeCandidate[];
	}
): Promise<StoredRecipeCandidate[]> {
	const now = input.now ?? new Date();
	const cached = input.cachedCandidates ?? await findCachedRecipeCandidates(database, input.queryKey, now);
	const seen = new Set(cached.map((candidate) => candidate.url));
	if (cached.length >= 3) return cached;

	const [results, policies] = await Promise.all([
		searchWikibooks(input.queryText),
		database.select().from(recipeSourcePolicies).where(eq(recipeSourcePolicies.status, 'approved'))
	]);
	const policyByHost = new Map(policies.map((policy) => [policy.hostname, policy]));
	const approved: StoredRecipeCandidate[] = [];
	const metadata: StoredRecipeCandidate[] = [];
	for (const result of results) {
		const url = new URL(result.url);
		if (seen.has(url.toString())) continue;
		seen.add(url.toString());
		const base = {
			id: crypto.randomUUID(), title: result.title, domain: url.hostname, url: url.toString(),
			snippet: result.snippet, sourceKey: sourceKey(url.toString()),
			licenseName: WIKIBOOKS_LICENSE_NAME,
			licenseUrl: WIKIBOOKS_LICENSE_URL,
			adapted: true
		};
		const policy = policyByHost.get(url.hostname);
		if (policy?.parser === 'mediawiki_cookbook' && policyAllows(policy, url) && approved.length < 3) {
			try {
				const facts = await fetchWikibooksRecipe(result.pageId);
				approved.push({ ...base, approved: true, facts });
				continue;
			} catch {
				// Keep the search result as metadata-only when approved extraction fails.
			}
		}
		metadata.push({ ...base, approved: false, facts: null });
	}
	return [...cached, ...approved, ...metadata].slice(0, 3);
}
