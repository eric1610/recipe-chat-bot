import { Parser } from 'htmlparser2';
import { sanitizeMessageContent } from '$lib/chat/content';
import type { RecipeFacts } from '$lib/recipes/types';
import { RECIPE_CUISINES } from './intent';

const API_URL = 'https://en.wikibooks.org/w/api.php';
const USER_AGENT = 'RecipeChatBot/1.0 (https://github.com/eric1610/recipe-chat-bot)';
const TIMEOUT_MS = 7_000;
const MAX_API_BYTES = 1_000_000;
const MAX_ITEMS = 100;
const MAX_ITEM_LENGTH = 500;

export const WIKIBOOKS_HOST = 'en.wikibooks.org';
export const WIKIBOOKS_LICENSE_NAME = 'CC BY-SA 4.0';
export const WIKIBOOKS_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

interface WikibooksPage {
	pageid?: unknown;
	title?: unknown;
	canonicalurl?: unknown;
	extract?: unknown;
}

interface WikibooksSearchPayload {
	query?: { pages?: WikibooksPage[] | Record<string, WikibooksPage> };
}

interface WikibooksParsePayload {
	parse?: {
		title?: unknown;
		revid?: unknown;
		text?: string | { '*': string };
		categories?: Array<{ '*': string }>;
	};
}

export interface WikibooksSearchResult {
	pageId: number;
	title: string;
	url: string;
	snippet: string;
}

interface WikibooksDependencies {
	fetch: typeof fetch;
}

const defaultDependencies: WikibooksDependencies = { fetch };

function cleanText(value: unknown, max: number): string {
	if (typeof value !== 'string') return '';
	return sanitizeMessageContent(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max);
}

function apiUrl(parameters: Record<string, string>): URL {
	const url = new URL(API_URL);
	for (const [key, value] of Object.entries({ format: 'json', formatversion: '2', maxlag: '5', ...parameters })) {
		url.searchParams.set(key, value);
	}
	return url;
}

async function apiJson<T>(url: URL, dependencies: WikibooksDependencies): Promise<T> {
	const response = await dependencies.fetch(url, {
		headers: { accept: 'application/json', 'user-agent': USER_AGENT },
		signal: AbortSignal.timeout(TIMEOUT_MS)
	});
	if (!response.ok) throw new Error('Wikibooks is temporarily unavailable.');
	const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
	if (Number.isFinite(declaredLength) && declaredLength > MAX_API_BYTES) {
		throw new Error('The Wikibooks response is too large.');
	}
	if (!response.body) throw new Error('Wikibooks returned an empty response.');
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let bytes = 0;
	let text = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		bytes += value.byteLength;
		if (bytes > MAX_API_BYTES) {
			await reader.cancel();
			throw new Error('The Wikibooks response is too large.');
		}
		text += decoder.decode(value, { stream: true });
	}
	let payload: T & { error?: unknown };
	try {
		payload = JSON.parse(text + decoder.decode()) as T & { error?: unknown };
	} catch {
		throw new Error('Wikibooks returned an invalid response.');
	}
	if (payload && typeof payload === 'object' && payload.error) {
		throw new Error('Wikibooks reported an API error.');
	}
	return payload;
}

function pages(payload: WikibooksSearchPayload): WikibooksPage[] {
	const value = payload.query?.pages;
	if (Array.isArray(value)) return value;
	return value && typeof value === 'object' ? Object.values(value) : [];
}

export async function _searchWikibooks(
	query: string,
	dependencies: WikibooksDependencies = defaultDependencies
): Promise<WikibooksSearchResult[]> {
	const payload = await apiJson<WikibooksSearchPayload>(apiUrl({
		action: 'query',
		generator: 'search',
		gsrsearch: `incategory:Recipes ${query}`,
		gsrnamespace: '102',
		gsrlimit: '8',
		prop: 'info|extracts',
		inprop: 'url',
		exintro: '1',
		explaintext: '1',
		exchars: '400'
	}), dependencies);
	return pages(payload).flatMap((page) => {
		if (typeof page.pageid !== 'number' || !Number.isSafeInteger(page.pageid) || page.pageid <= 0 || typeof page.canonicalurl !== 'string') return [];
		const url = new URL(page.canonicalurl);
		if (url.protocol !== 'https:' || url.hostname !== WIKIBOOKS_HOST || !url.pathname.startsWith('/wiki/Cookbook:')) return [];
		const title = cleanText(page.title, 200).replace(/^Cookbook:/, '');
		if (!title) return [];
		return [{ pageId: page.pageid, title, url: url.toString(), snippet: cleanText(page.extract, 400) }];
	});
}

function sectionName(value: string): 'ingredients' | 'instructions' | null {
	const normalized = value.toLowerCase();
	if (/ingredient/.test(normalized)) return 'ingredients';
	if (/procedure|direction|instruction|preparation|method/.test(normalized)) return 'instructions';
	return null;
}

export function extractWikibooksFacts(
	html: string,
	input: { title: string; categories?: string[] }
): RecipeFacts | null {
	let headingDepth = 0;
	let headingText = '';
	let section: 'ingredients' | 'instructions' | null = null;
	let listItemDepth = 0;
	let listItemText = '';
	let rowDepth = 0;
	let cell: 'label' | 'data' | null = null;
	let cellText = '';
	let rowLabel = '';
	const ingredients: string[] = [];
	const instructions: string[] = [];
	const infobox = new Map<string, string>();
	const parser = new Parser({
		onopentag(name) {
			if (name === 'h2') { headingDepth += 1; headingText = ''; }
			if (name === 'li' && section && listItemDepth === 0) { listItemDepth = 1; listItemText = ''; }
			else if (name === 'li' && listItemDepth > 0) listItemDepth += 1;
			if (name === 'tr') { rowDepth += 1; rowLabel = ''; }
			if (rowDepth > 0 && (name === 'th' || name === 'td')) { cell = name === 'th' ? 'label' : 'data'; cellText = ''; }
		},
		ontext(text) {
			if (headingDepth) headingText += text;
			if (listItemDepth === 1) listItemText += text;
			if (cell) cellText += text;
		},
		onclosetag(name) {
			if (name === 'h2' && headingDepth) {
				headingDepth -= 1;
				section = sectionName(headingText);
			}
			if (name === 'li' && listItemDepth > 0) {
				if (listItemDepth === 1 && section) {
					const item = cleanText(listItemText, MAX_ITEM_LENGTH);
					if (item) (section === 'ingredients' ? ingredients : instructions).push(item);
				}
				listItemDepth -= 1;
			}
			if ((name === 'th' || name === 'td') && cell) {
				const value = cleanText(cellText, 200);
				if (cell === 'label') rowLabel = value.toLowerCase();
				else if (rowLabel && value) infobox.set(rowLabel, value);
				cell = null;
			}
			if (name === 'tr' && rowDepth) rowDepth -= 1;
		}
	});
	parser.write(html);
	parser.end();
	if (ingredients.length === 0 || instructions.length === 0) return null;
	const categories = (input.categories ?? []).map((value) => value.replace(/_/g, ' '));
	const cuisineNames = new Set(RECIPE_CUISINES);
	const cuisines = categories
		.filter((value) => / recipes$/i.test(value) && !/^recipes /i.test(value))
		.map((value) => value.replace(/ recipes$/i, ''))
		.filter((value) => cuisineNames.has(value.toLowerCase() as (typeof RECIPE_CUISINES)[number]))
		.slice(0, 20);
	return {
		title: cleanText(input.title.replace(/^Cookbook:/, ''), 200),
		yield: infobox.get('servings') ?? infobox.get('yield') ?? null,
		prepTime: infobox.get('preparation time') ?? infobox.get('prep time') ?? null,
		cookTime: infobox.get('cooking time') ?? infobox.get('cook time') ?? null,
		totalTime: infobox.get('time') ?? infobox.get('total time') ?? null,
		cuisines,
		categories: categories.slice(0, 20),
		ingredients: ingredients.slice(0, MAX_ITEMS),
		instructions: instructions.slice(0, MAX_ITEMS)
	};
}

export async function _fetchWikibooksRecipe(
	pageId: number,
	dependencies: WikibooksDependencies = defaultDependencies
): Promise<RecipeFacts> {
	const payload = await apiJson<WikibooksParsePayload>(apiUrl({
		action: 'parse',
		pageid: String(pageId),
		prop: 'text|revid|categories',
		disableeditsection: '1',
		disabletoc: '1'
	}), dependencies);
	const parsed = payload.parse;
	const html = typeof parsed?.text === 'string' ? parsed.text : parsed?.text?.['*'];
	const title = cleanText(parsed?.title, 200);
	if (!html || !title) throw new Error('The Wikibooks page is not a usable recipe.');
	const facts = extractWikibooksFacts(html, {
		title,
		categories: parsed?.categories?.map((category) => category['*'])
	});
	if (!facts) throw new Error('The Wikibooks page is not a usable recipe.');
	return facts;
}

export const searchWikibooks = (query: string) => _searchWikibooks(query);
export const fetchWikibooksRecipe = (pageId: number) => _fetchWikibooksRecipe(pageId);
