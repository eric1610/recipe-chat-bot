<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Recipe Chat Bot</title>
	<meta
		name="description"
		content="A friendly recipe companion powered by SvelteKit and Skeleton."
	/>
	<meta name="theme-color" content="#3d315d" media="(prefers-color-scheme: dark)" />
	<meta name="theme-color" content="#eee9f8" media="(prefers-color-scheme: light)" />
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
