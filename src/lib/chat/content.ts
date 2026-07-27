const disallowedControlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const leadingInvisibleCharacters = /^[\u200b-\u200f\ufeff]+/;

/**
 * Normalize untrusted message source before it is stored or sent to the model.
 * Markdown and ordinary punctuation are intentionally preserved; executable
 * HTML is handled at the rendering boundary.
 */
export function sanitizeMessageContent(value: string): string {
	return value
		.normalize('NFC')
		.replace(/\r\n?/g, '\n')
		.replace(disallowedControlCharacters, '')
		.replace(leadingInvisibleCharacters, '')
		.trim();
}
