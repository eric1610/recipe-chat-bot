<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Recipe Chat Bot</title>
	<meta
		name="description"
		content="A simple SvelteKit foundation for a helpful recipe companion."
	/>
	<meta name="theme-color" content="#f4f4f2" />
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
