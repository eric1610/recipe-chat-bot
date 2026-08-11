import { describe, expect, it, vi } from 'vitest';
import { _fetchRecipeFacts, parsePublicHttpsUrl } from './fetch';

describe('recipe source URL validation', () => {
	it.each([
		'https://recipes.example.com/dinner',
		'https://recipes.example.com:443/dinner'
	])('accepts public-shaped HTTPS URLs: %s', (url) => {
		expect(parsePublicHttpsUrl(url)?.hostname).toBe('recipes.example.com');
	});

	it.each([
		'http://recipes.example.com/dinner',
		'https://user:pass@recipes.example.com/dinner',
		'https://localhost/dinner',
		'https://127.0.0.1/dinner',
		'https://recipes.example.com:8443/dinner'
	])('rejects unsafe source URLs: %s', (url) => {
		expect(parsePublicHttpsUrl(url)).toBeNull();
	});

	it('obeys robots before extracting bounded HTML', async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response('User-agent: *\nAllow: /', { status: 200 }))
			.mockResolvedValueOnce(new Response(`<script type="application/ld+json">${JSON.stringify({
				'@type': 'Recipe', name: 'Soup', recipeIngredient: ['1 onion'], recipeInstructions: ['Cook it.']
			})}</script>`, { status: 200, headers: { 'content-type': 'text/html' } }));
		const result = await _fetchRecipeFacts('https://recipes.example.com/soup', {
			lookupHost: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) as never,
			fetch: fetchMock
		});

		expect(result.facts.title).toBe('Soup');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('rejects robots denial and private DNS results', async () => {
		const deniedFetch = vi.fn().mockResolvedValue(new Response('User-agent: *\nDisallow: /', { status: 200 }));
		await expect(_fetchRecipeFacts('https://recipes.example.com/soup', {
			lookupHost: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) as never,
			fetch: deniedFetch
		})).rejects.toThrow('does not allow');
		expect(deniedFetch).toHaveBeenCalledOnce();

		const privateFetch = vi.fn();
		await expect(_fetchRecipeFacts('https://recipes.example.com/soup', {
			lookupHost: vi.fn(async () => [{ address: '127.0.0.1', family: 4 }]) as never,
			fetch: privateFetch
		})).rejects.toThrow('does not allow');
		expect(privateFetch).not.toHaveBeenCalled();
	});

	it('revalidates redirects and rejects an unsafe destination', async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response('User-agent: *\nAllow: /', { status: 200 }))
			.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }));
		await expect(_fetchRecipeFacts('https://recipes.example.com/soup', {
			lookupHost: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) as never,
			fetch: fetchMock
		})).rejects.toThrow('unsafe URL');
	});

	it('does not fetch a public redirect outside the approved source policy', async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response('User-agent: *\nAllow: /', { status: 200 }))
			.mockResolvedValueOnce(new Response(null, {
				status: 302,
				headers: { location: 'https://unapproved.example/recipe' }
			}));
		await expect(_fetchRecipeFacts('https://recipes.example.com/soup', {
			lookupHost: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) as never,
			fetch: fetchMock
		}, (url) => url.hostname === 'recipes.example.com')).rejects.toThrow('approved policy');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
