import { createHash } from 'node:crypto';
import { sanitizeMessageContent } from '$lib/chat/content';
import type { StoredRecipeCandidate } from '$lib/recipes/types';
import type { Database } from '$lib/server/db';
import { recipeCache, recipeSourcePolicies } from '$lib/server/db/schema';
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { fetchRecipeFacts, parsePublicHttpsUrl } from './fetch';

interface BraveResult {
	title?: unknown;
	url?: unknown;
	description?: unknown;
}

interface BravePayload {
	web?: { results?: BraveResult[] };
}

function plainText(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return sanitizeMessageContent(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')).slice(0, max);
}

export function sourceKey(url: string): string {
	return createHash('sha256').update(url).digest('hex');
}

function policyAllows(policy: { allowedPathPrefixes: string[] }, url: URL): boolean {
	return policy.allowedPathPrefixes.length === 0 || policy.allowedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix));
}

export async function searchBrave(query: string, apiKey: string): Promise<BraveResult[]> {
	const endpoint = new URL('https://api.search.brave.com/res/v1/web/search');
	endpoint.searchParams.set('q', `${query} recipe`);
	endpoint.searchParams.set('count', '8');
	endpoint.searchParams.set('safesearch', 'strict');
	const response = await fetch(endpoint, {
		headers: { accept: 'application/json', 'x-subscription-token': apiKey },
		signal: AbortSignal.timeout(7_000)
	});
	if (!response.ok) throw new Error('Recipe search is temporarily unavailable.');
	const payload = (await response.json()) as BravePayload;
	return Array.isArray(payload.web?.results) ? payload.web.results.slice(0, 8) : [];
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
		facts: record.facts
	}] : []);
}

export async function discoverRecipeCandidates(
	database: Database,
	input: {
		queryText: string;
		queryKey: string;
		apiKey: string;
		now?: Date;
		cachedCandidates?: StoredRecipeCandidate[];
	}
): Promise<StoredRecipeCandidate[]> {
	const now = input.now ?? new Date();
	const cached = input.cachedCandidates ?? await findCachedRecipeCandidates(database, input.queryKey, now);
	const seen = new Set(cached.map((candidate) => candidate.url));
	if (cached.length >= 3) return cached;

	const [results, policies] = await Promise.all([
		searchBrave(input.queryText, input.apiKey),
		database.select().from(recipeSourcePolicies).where(eq(recipeSourcePolicies.status, 'approved'))
	]);
	const policyByHost = new Map(policies.map((policy) => [policy.hostname, policy]));
	const approved: StoredRecipeCandidate[] = [];
	const metadata: StoredRecipeCandidate[] = [];
	for (const result of results) {
		const url = typeof result.url === 'string' ? parsePublicHttpsUrl(result.url) : null;
		if (!url || seen.has(url.toString())) continue;
		seen.add(url.toString());
		const title = plainText(result.title, 200);
		if (!title) continue;
		const base = {
			id: crypto.randomUUID(), title, domain: url.hostname, url: url.toString(),
			snippet: plainText(result.description, 400), sourceKey: sourceKey(url.toString())
		};
		const policy = policyByHost.get(url.hostname);
		if (policy && policyAllows(policy, url) && approved.length < 3) {
			try {
				const extracted = await fetchRecipeFacts(
					url.toString(),
					(candidateUrl) => candidateUrl.hostname === policy.hostname && policyAllows(policy, candidateUrl)
				);
				const finalUrl = new URL(extracted.finalUrl);
				if (finalUrl.hostname !== url.hostname || !policyAllows(policy, finalUrl)) throw new Error('The approved source redirected outside its policy.');
				approved.push({ ...base, url: extracted.finalUrl, sourceKey: sourceKey(extracted.finalUrl), approved: true, facts: extracted.facts });
				continue;
			} catch {
				// Keep the search result as metadata-only when approved extraction fails.
			}
		}
		metadata.push({ ...base, approved: false, facts: null });
	}
	return [...cached, ...approved, ...metadata].slice(0, 3);
}
