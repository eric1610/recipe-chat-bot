(() => {
	const storageKey = 'recipe-chat-bot-color-mode';
	let savedMode = null;

	try {
		savedMode = localStorage.getItem(storageKey);
	} catch {
		// Storage can be unavailable in privacy-restricted browsing contexts.
	}

	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const mode = savedMode === 'light' || savedMode === 'dark' ? savedMode : prefersDark ? 'dark' : 'light';
	document.documentElement.dataset.mode = mode;
})();
