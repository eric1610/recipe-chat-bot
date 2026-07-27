<script lang="ts">
	import { renderSafeMarkdown } from '$lib/chat/markdown';

	let { source }: { source: string } = $props();
	let rendered = $derived(renderSafeMarkdown(source));
</script>

<div
	class="prose prose-sm max-w-none dark:prose-invert prose-headings:text-inherit prose-p:text-inherit prose-strong:text-inherit prose-li:text-inherit prose-blockquote:text-inherit prose-code:text-inherit prose-th:text-inherit prose-td:text-inherit prose-a:text-primary-600-400 prose-table:block prose-table:max-w-full prose-table:overflow-x-auto"
>
	{@html rendered}
</div>
