<script lang="ts">
	import type { PendingRecipeSearchView, RecipeCandidateView } from '$lib/recipes/types';

	let {
		search,
		disabled = false,
		onselect
	}: {
		search: PendingRecipeSearchView;
		disabled?: boolean;
		onselect: (candidate: RecipeCandidateView) => void;
	} = $props();
</script>

<div class="mt-4 grid gap-3" aria-label="Recipe sources">
	{#each search.candidates as candidate}
		<section class="rounded-container border border-surface-300-700 bg-surface-50-950 p-4">
			<div class="flex flex-wrap items-start justify-between gap-2">
				<div class="min-w-0">
					<h3 class="font-black text-surface-950-50">{candidate.title}</h3>
					<p class="mt-1 text-xs text-surface-600-400">{candidate.domain}</p>
				</div>
				<span class={`badge px-2 py-1 text-xs ${candidate.approved ? 'bg-tertiary-500 text-tertiary-contrast-500' : 'bg-surface-200-800 text-surface-700-300'}`}>
					{candidate.approved ? 'Available in app' : 'External source'}
				</span>
			</div>
			{#if candidate.snippet}<p class="mt-3 text-sm leading-6 text-surface-700-300">{candidate.snippet}</p>{/if}
			{#if candidate.licenseName && candidate.licenseUrl}
				<p class="mt-2 text-xs text-surface-600-400">
					Adapted source · <a class="font-bold underline" href={candidate.licenseUrl} target="_blank" rel="noopener noreferrer">{candidate.licenseName}</a>
				</p>
			{/if}
			<div class="mt-4 flex flex-wrap gap-2">
				<a class="btn preset-tonal-surface text-sm" href={candidate.url} target="_blank" rel="noopener noreferrer">View source</a>
				{#if candidate.approved}
					<button
						class="btn preset-filled-primary-500 text-sm font-bold"
						type="button"
						disabled={disabled || search.status !== 'pending'}
						onclick={() => onselect(candidate)}
					>Use this source</button>
				{/if}
			</div>
		</section>
	{/each}
	{#if search.status === 'expired'}<p class="text-xs font-bold text-recipe-red-ink dark:text-recipe-red">These source choices expired. Send the request again to refresh them.</p>{/if}
</div>
