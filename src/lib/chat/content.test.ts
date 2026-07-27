import { describe, expect, it } from 'vitest';
import { sanitizeMessageContent } from './content';

describe('sanitizeMessageContent', () => {
	it('normalizes line endings, Unicode, and surrounding whitespace', () => {
		expect(sanitizeMessageContent('  Cafe\u0301\r\nrecipe  ')).toBe('Café\nrecipe');
	});

	it('removes storage-hostile controls while preserving Markdown', () => {
		expect(sanitizeMessageContent('\ufeff\u200b# Soup\u0000\n\n- carrots\t\u0007')).toBe(
			'# Soup\n\n- carrots'
		);
	});

	it('is idempotent', () => {
		const once = sanitizeMessageContent('  **Dinner**\r\n\u0000ideas  ');
		expect(sanitizeMessageContent(once)).toBe(once);
	});
});
