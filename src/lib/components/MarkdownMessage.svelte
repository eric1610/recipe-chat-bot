<script lang="ts">
	import { renderSafeMarkdown } from '$lib/chat/markdown';

	let { source, allergenTerms = [] }: { source: string; allergenTerms?: string[] } = $props();
	let rendered = $derived(renderSafeMarkdown(source, allergenTerms));
</script>

<div
	class="prose prose-sm max-w-none dark:prose-invert prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-li:text-inherit prose-blockquote:text-inherit prose-code:text-inherit prose-th:text-inherit prose-td:text-inherit prose-a:text-primary-600-400 prose-table:block prose-table:max-w-full prose-table:overflow-x-auto"
>
	{@html rendered}
</div>

<style>
	:global(.recipe-confidence) {
		margin-block: 1rem;
		border: 1px solid;
		border-left-width: 0.35rem;
		border-radius: var(--radius-container);
		padding: 0.75rem 1rem;
	}

	:global(.recipe-confidence > :first-child) {
		margin-top: 0;
	}

	:global(.recipe-confidence > :last-child) {
		margin-bottom: 0;
	}

	:global(.recipe-confidence-high) {
		border-color: var(--color-tertiary-500);
		background: color-mix(in srgb, var(--color-tertiary-500) 16%, transparent);
	}

	:global(.recipe-confidence-medium) {
		border-color: var(--color-recipe-yellow);
		background: color-mix(in srgb, var(--color-recipe-yellow) 24%, transparent);
	}

	:global(.recipe-confidence-low) {
		border-color: var(--color-recipe-red);
		background: color-mix(in srgb, var(--color-recipe-red) 20%, transparent);
	}
</style>
