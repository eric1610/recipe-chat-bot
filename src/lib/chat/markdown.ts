import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { parseRecipeConfidenceReport } from './recipe-confidence';

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

const markdown = new Marked({
	async: false,
	breaks: true,
	gfm: true,
	renderer: {
		blockquote(token) {
			const report = parseRecipeConfidenceReport(token.text);
			if (!report) return `<blockquote>\n${this.parser.parse(token.tokens)}</blockquote>\n`;
			return `<aside class="recipe-confidence recipe-confidence-${report.level}">\n${this.parser.parse(token.tokens)}</aside>\n`;
		},
		// LLM and user-authored HTML is displayed as text. Only HTML generated
		// from Markdown syntax is eligible for the sanitizer allowlist below.
		html({ text }) {
			return escapeHtml(text);
		},
		// Remote images can track readers. Keep the alt text without loading them.
		image({ text }) {
			return escapeHtml(text);
		}
	}
});

const allowedTags = [
	'a',
	'aside',
	'blockquote',
	'br',
	'code',
	'del',
	'em',
	'h1',
	'h2',
	'h3',
	'h4',
	'hr',
	'li',
	'ol',
	'p',
	'pre',
	'strong',
	'table',
	'tbody',
	'td',
	'th',
	'thead',
	'tr',
	'ul'
];

/** Render untrusted Markdown to HTML that is safe to pass to Svelte's {@html}. */
export function renderSafeMarkdown(source: string): string {
	const rendered = markdown.parse(source, { async: false });
	return sanitizeHtml(rendered, {
		allowedTags,
		allowedAttributes: {
			a: ['href', 'title', 'target', 'rel'],
			aside: ['class']
		},
		allowedClasses: {
			aside: [
				'recipe-confidence',
				'recipe-confidence-high',
				'recipe-confidence-medium',
				'recipe-confidence-low'
			]
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowProtocolRelative: false,
		transformTags: {
			a: (_tagName, attributes) => ({
				tagName: 'a',
				attribs: {
					...attributes,
					target: '_blank',
					rel: 'nofollow noopener noreferrer'
				}
			})
		}
	});
}
