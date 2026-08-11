import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import robotsParser from 'robots-parser';
import { extractRecipeFacts } from './extract';
import type { RecipeFacts } from '$lib/recipes/types';

const USER_AGENT = 'RecipeChatBot/1.0 (+https://github.com/eric1610/recipe-chat-bot)';
const MAX_HTML_BYTES = 1_000_000;
const MAX_ROBOTS_BYTES = 256_000;
const FETCH_TIMEOUT_MS = 5_000;

interface FetchDependencies {
	lookupHost: typeof lookup;
	fetch: typeof fetch;
}

type UrlGuard = (url: URL) => boolean;

const defaultDependencies: FetchDependencies = { lookupHost: lookup, fetch };

function unsafeIpv4(address: string): boolean {
	const parts = address.split('.').map(Number);
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
	const [a, b] = parts;
	return (
		a === 0 || a === 10 || a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		a >= 224
	);
}

function unsafeAddress(address: string): boolean {
	if (isIP(address) === 4) return unsafeIpv4(address);
	if (isIP(address) === 6) {
		const normalized = address.toLowerCase();
		return normalized === '::1' || normalized === '::' || /^f[cd]/.test(normalized) || /^fe[89ab]/.test(normalized);
	}
	return true;
}

export function parsePublicHttpsUrl(value: string): URL | null {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
		if (isIP(url.hostname) || url.hostname === 'localhost' || !url.hostname.includes('.')) return null;
		return url;
	} catch {
		return null;
	}
}

async function assertPublicHost(url: URL, dependencies: FetchDependencies): Promise<void> {
	const addresses = await dependencies.lookupHost(url.hostname, { all: true, verbatim: true });
	if (addresses.length === 0 || addresses.some(({ address }) => unsafeAddress(address))) {
		throw new Error('The source hostname is not public.');
	}
}

async function boundedText(response: Response, maxBytes: number): Promise<string> {
	if (!response.body) return '';
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let bytes = 0;
	let output = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		bytes += value.byteLength;
		if (bytes > maxBytes) {
			await reader.cancel();
			throw new Error('The source response is too large.');
		}
		output += decoder.decode(value, { stream: true });
	}
	return output + decoder.decode();
}

async function fetchPublic(
	url: URL,
	maxBytes: number,
	redirects: number,
	dependencies: FetchDependencies,
	isAllowed: UrlGuard
): Promise<{ response: Response; url: URL; text: string }> {
	let current = url;
	for (let redirect = 0; redirect <= redirects; redirect += 1) {
		if (!isAllowed(current)) throw new Error('The source redirected outside its approved policy.');
		await assertPublicHost(current, dependencies);
		const response = await dependencies.fetch(current, {
			headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain;q=0.9' },
			redirect: 'manual',
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
		});
		if ([301, 302, 303, 307, 308].includes(response.status)) {
			const location = response.headers.get('location');
			if (!location || redirect === redirects) throw new Error('The source redirected too many times.');
			const next = parsePublicHttpsUrl(new URL(location, current).toString());
			if (!next) throw new Error('The source redirected to an unsafe URL.');
			current = next;
			continue;
		}
		return { response, url: current, text: await boundedText(response, maxBytes) };
	}
	throw new Error('The source could not be fetched.');
}

async function robotsAllows(url: URL, dependencies: FetchDependencies): Promise<boolean> {
	try {
		const robotsUrl = new URL('/robots.txt', url.origin);
		const { response, text } = await fetchPublic(
			robotsUrl,
			MAX_ROBOTS_BYTES,
			1,
			dependencies,
			(candidate) => candidate.hostname === url.hostname
		);
		if (response.status === 404 || response.status === 410) return true;
		if (!response.ok) return false;
		return robotsParser(robotsUrl.toString(), text).isAllowed(url.toString(), USER_AGENT) !== false;
	} catch {
		return false;
	}
}

export async function _fetchRecipeFacts(
	value: string,
	dependencies: FetchDependencies,
	isAllowed: UrlGuard = () => true
): Promise<{ facts: RecipeFacts; finalUrl: string }> {
	const url = parsePublicHttpsUrl(value);
	if (!url || !isAllowed(url)) throw new Error('The source URL is not allowed.');
	if (!(await robotsAllows(url, dependencies))) throw new Error('The source does not allow this crawler.');
	const { response, text, url: finalUrl } = await fetchPublic(
		url,
		MAX_HTML_BYTES,
		3,
		dependencies,
		isAllowed
	);
	if (!response.ok) throw new Error('The source page could not be loaded.');
	if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('text/html')) {
		throw new Error('The source is not an HTML page.');
	}
	const facts = extractRecipeFacts(text);
	if (!facts) throw new Error('The source does not contain a usable structured recipe.');
	return { facts, finalUrl: finalUrl.toString() };
}

export function fetchRecipeFacts(value: string, isAllowed: UrlGuard) {
	return _fetchRecipeFacts(value, defaultDependencies, isAllowed);
}
