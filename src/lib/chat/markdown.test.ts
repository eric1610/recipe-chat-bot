import { describe, expect, it } from 'vitest';
import { renderSafeMarkdown } from './markdown';

describe('renderSafeMarkdown', () => {
	it('renders common recipe Markdown', () => {
		const html = renderSafeMarkdown('## Soup\n\n- 2 carrots\n- **1 onion**\n\n`20 minutes`');

		expect(html).toContain('<h2>Soup</h2>');
		expect(html).toContain('<ul>');
		expect(html).toContain('<strong>1 onion</strong>');
		expect(html).toContain('<code>20 minutes</code>');
	});

	it('treats raw HTML as text and removes executable attributes and schemes', () => {
		const html = renderSafeMarkdown(
			'<script>alert(1)</script>\n\n<a href="https://evil.example" onclick="steal()">raw link</a>\n\n[bad](javascript:alert(1))'
		);

		expect(html).not.toContain('<script');
		expect(html).not.toContain('<a href="https://evil.example"');
		expect(html).not.toContain('javascript:');
		expect(html).toContain('&lt;script&gt;');
	});

	it('allows safe links with isolation attributes and blocks remote images', () => {
		const html = renderSafeMarkdown(
			'[recipe](https://example.com/recipe "Recipe") ![tracking](https://example.com/pixel.gif)'
		);

		expect(html).toContain('href="https://example.com/recipe"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="nofollow noopener noreferrer"');
		expect(html).not.toContain('<img');
		expect(html).not.toContain('pixel.gif');
	});

	it('blocks encoded, data, protocol-relative, SVG, and event-handler payloads', () => {
		const html = renderSafeMarkdown(
			'[encoded](jav&#x61;script:alert(1)) [data](data:text/html,<script>alert(1)</script>)\n\n' +
				'[relative](//attacker.example/path)\n\n' +
				'<svg onload="alert(1)"><a href="javascript:alert(2)">x</a></svg>'
		);

		expect(html).not.toMatch(/<a\b[^>]*href="(?:javascript:|data:|\/\/)/i);
		expect(html).not.toMatch(/<(?:svg|script)|<[^>]+\sonload=/i);
		expect(html).toContain('&lt;svg');
		expect(html).toContain('onload="alert(1)"');
	});

	it.each([
		['High', 85, 'high'],
		['Medium', 65, 'medium'],
		['Low', 35, 'low']
	])('renders a valid %s confidence report as a themed callout', (label, score, theme) => {
		const html = renderSafeMarkdown(
			`> **Ingredient accuracy estimate: ${label} (${score}%)**\n>\n> AI best-judgment estimate; not independently verified.`
		);

		expect(html).toContain(`class="recipe-confidence recipe-confidence-${theme}"`);
		expect(html).toContain(`${label} (${score}%)`);
	});

	it('does not theme a confidence report whose label and percentage disagree', () => {
		const html = renderSafeMarkdown('> **Instruction accuracy estimate: High (65%)**');

		expect(html).toContain('<blockquote>');
		expect(html).not.toContain('recipe-confidence');
	});

	it('does not accept confidence classes from raw model HTML', () => {
		const html = renderSafeMarkdown(
			'<aside class="recipe-confidence recipe-confidence-high" onclick="steal()">fake</aside>'
		);

		expect(html).not.toContain('<aside');
		expect(html).toContain('&lt;aside');
		expect(html).toContain('onclick="steal()"');
	});
});
