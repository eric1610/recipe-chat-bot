import { describe, expect, it, vi } from 'vitest';
import { _fetchWikibooksRecipe, _searchWikibooks, extractWikibooksFacts } from './wikibooks';

const recipeHtml = `
	<table class="infobox"><tr><th>Servings</th><td>4</td></tr><tr><th>Time</th><td>30 minutes</td></tr></table>
	<h2>Ingredients</h2><ul><li>2 cups rice</li><li>1 onion</li></ul>
	<h3>Optional</h3><ul><li>Fresh herbs</li></ul>
	<h2>Procedure</h2><ol><li>Rinse the rice.</li><li>Cook until tender.</li></ol>
	<h2>Notes</h2><ul><li>This should not be an ingredient or instruction.</li></ul>`;

describe('Wikibooks recipe source', () => {
	it('normalizes MediaWiki search results and rejects off-source URLs', async () => {
		let requestedUrl: URL | null = null;
		const fetchMock = vi.fn(async (url: URL | RequestInfo) => {
			requestedUrl = new URL(url.toString());
			return new Response(JSON.stringify({
			query: { pages: [
				{ pageid: 10, title: 'Cookbook:Rice', canonicalurl: 'https://en.wikibooks.org/wiki/Cookbook:Rice', extract: 'A rice recipe.' },
				{ pageid: 11, title: 'Cookbook:Unsafe', canonicalurl: 'https://example.com/recipe', extract: 'No.' }
			] }
		}), { status: 200 });
		});
		const results = await _searchWikibooks('rice', { fetch: fetchMock });

		expect(results).toEqual([{
			pageId: 10,
			title: 'Rice',
			url: 'https://en.wikibooks.org/wiki/Cookbook:Rice',
			snippet: 'A rice recipe.'
		}]);
		expect(requestedUrl!.searchParams.get('gsrsearch')).toBe('incategory:Recipes rice');
	});

	it('extracts bounded recipe sections and infobox metadata', () => {
		const facts = extractWikibooksFacts(recipeHtml, {
			title: 'Cookbook:Rice',
			categories: ['Thai_recipes', 'Main_course_recipes']
		});

		expect(facts).toMatchObject({
			title: 'Rice', yield: '4', totalTime: '30 minutes',
			cuisines: ['Thai'],
			ingredients: ['2 cups rice', '1 onion', 'Fresh herbs'],
			instructions: ['Rinse the rice.', 'Cook until tender.']
		});
	});

	it('loads a recipe only through the fixed MediaWiki API endpoint', async () => {
		let requestedUrl: URL | null = null;
		const fetchMock = vi.fn(async (url: URL | RequestInfo) => {
			requestedUrl = new URL(url.toString());
			return new Response(JSON.stringify({
			parse: {
				title: 'Cookbook:Rice', revid: 123, text: recipeHtml,
				categories: [{ '*': 'Thai_recipes' }]
			}
		}), { status: 200 });
		});
		const facts = await _fetchWikibooksRecipe(10, { fetch: fetchMock });

		expect(facts.title).toBe('Rice');
		expect(requestedUrl!.origin).toBe('https://en.wikibooks.org');
		expect(requestedUrl!.searchParams.get('pageid')).toBe('10');
	});
});
