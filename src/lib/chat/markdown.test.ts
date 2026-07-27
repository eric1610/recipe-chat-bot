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
});
