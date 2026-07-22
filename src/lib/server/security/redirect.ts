export function safeRedirect(value: string | null): string {
	if (!value || /[\\\u0000-\u001f\u007f]/.test(value) || /%5c/i.test(value)) return '/chat';
	try {
		const base = new URL('https://recipe-chat.invalid');
		const destination = new URL(value, base);
		if (destination.origin !== base.origin || !['/chat', '/settings'].includes(destination.pathname)) {
			return '/chat';
		}
		return `${destination.pathname}${destination.search}`;
	} catch {
		return '/chat';
	}
}
