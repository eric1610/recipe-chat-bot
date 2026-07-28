const chatPath = /^\/chat(?:\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/i;

export function safeRedirect(value: string | null): string {
	if (!value || /[\\\u0000-\u001f\u007f]/.test(value) || /%5c/i.test(value)) return '/chat';
	try {
		const base = new URL('https://recipe-chat.invalid');
		const destination = new URL(value, base);
		if (
			destination.origin !== base.origin ||
			(!chatPath.test(destination.pathname) && destination.pathname !== '/settings')
		) {
			return '/chat';
		}
		return `${destination.pathname}${destination.search}`;
	} catch {
		return '/chat';
	}
}
