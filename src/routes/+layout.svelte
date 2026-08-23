<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { provideChatRetryState } from '$lib/chat/retry-state.svelte';
	import { afterNavigate } from '$app/navigation';
	import { base } from '$app/paths';
	import '../app.css';

	let { children } = $props();
	const chatRetryState = provideChatRetryState();

	afterNavigate(({ to }) => {
		const pending = chatRetryState.current;
		if (!pending) return;
		if (to?.url.pathname !== `${base}/chat/${pending.conversationId}`) chatRetryState.clear();
	});
</script>

<svelte:head>
	<title>Recipe Chat Bot</title>
	<meta
		name="description"
		content="A friendly recipe companion powered by SvelteKit and Skeleton."
	/>
	<meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
	<meta name="theme-color" content="#eee9f8" media="(prefers-color-scheme: light)" />
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
