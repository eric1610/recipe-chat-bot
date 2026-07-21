<script lang="ts">
	import type { UserPreferences } from '$lib/chat/types';
	let { data, form }: {
		data: { preferences: UserPreferences };
		form?: { preferencesSaved?: boolean; preferenceError?: string } | null;
	} = $props();
	let confirmDelete = $state(false);
	const join = (values: string[]) => values.join(', ');
</script>

<svelte:head>
	<title>Preferences — Recipe Chat Bot</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="mx-auto min-h-svh w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
	<header class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<a class="text-sm font-bold text-primary-500 no-underline" href="/chat">← Back to chat</a>
			<h1 class="mt-3 text-4xl font-black text-surface-950-50">Your cooking context</h1>
			<p class="mt-3 max-w-2xl leading-7 text-surface-700-300">These preferences will help future recipe conversations fit your kitchen and household.</p>
		</div>
	</header>

	<form method="POST" action="?/updatePreferences" class="card mt-9 grid gap-6 bg-surface-50-950 p-6 ring-1 ring-surface-300-700 sm:p-8">
		{#if form?.preferencesSaved}
			<p class="rounded-container bg-secondary-500/15 p-3 text-sm font-bold text-secondary-700-300" role="status">Preferences saved.</p>
		{:else if form?.preferenceError}
			<p class="rounded-container bg-recipe-red p-3 text-sm font-bold text-recipe-red-ink" role="alert">{form.preferenceError}</p>
		{/if}

		<div class="grid gap-5 sm:grid-cols-2">
			<label class="grid gap-2 font-bold text-surface-950-50">Dietary preferences
				<input class="input" name="diets" value={join(data.preferences.diets)} placeholder="Vegetarian, low sodium" />
				<span class="text-xs font-normal text-surface-600-400">Separate items with commas.</span>
			</label>
			<label class="grid gap-2 font-bold text-surface-950-50">Allergies
				<input class="input" name="allergies" value={join(data.preferences.allergies)} placeholder="Peanuts, shellfish" />
				<span class="text-xs font-normal text-surface-600-400">This context does not replace medical advice.</span>
			</label>
			<label class="grid gap-2 font-bold text-surface-950-50">Disliked ingredients
				<input class="input" name="dislikedIngredients" value={join(data.preferences.dislikedIngredients)} placeholder="Cilantro, olives" />
			</label>
			<label class="grid gap-2 font-bold text-surface-950-50">Preferred cuisines
				<input class="input" name="preferredCuisines" value={join(data.preferences.preferredCuisines)} placeholder="Korean, Italian" />
			</label>
			<label class="grid gap-2 font-bold text-surface-950-50">Cooking skill
				<select class="select" name="cookingSkill" value={data.preferences.cookingSkill ?? ''}>
					<option value="">Not specified</option>
					<option value="beginner">Beginner</option>
					<option value="intermediate">Intermediate</option>
					<option value="advanced">Advanced</option>
				</select>
			</label>
			<label class="grid gap-2 font-bold text-surface-950-50">Household size
				<input class="input" type="number" name="householdSize" min="1" max="30" value={data.preferences.householdSize ?? ''} />
			</label>
		</div>

		<label class="grid gap-2 font-bold text-surface-950-50">Anything else the assistant should know?
			<textarea class="textarea min-h-36" name="notes" maxlength="2000" placeholder="Weeknights should stay under 30 minutes…">{data.preferences.notes}</textarea>
		</label>

		<div><button class="btn preset-filled-primary-500 font-bold" type="submit">Save preferences</button></div>
	</form>

	<section class="card mt-8 border border-recipe-red/50 bg-surface-50-950 p-6 sm:p-8" aria-labelledby="danger-title">
		<h2 id="danger-title" class="text-xl font-black text-surface-950-50">Delete account</h2>
		<p class="mt-2 max-w-2xl text-sm leading-6 text-surface-700-300">Permanently removes your local app account, OAuth connections, preferences, sessions, conversations, and messages. It does not delete your Google or GitHub account.</p>
		<label class="mt-5 flex items-start gap-3 text-sm font-semibold text-surface-950-50">
			<input class="checkbox mt-0.5" type="checkbox" bind:checked={confirmDelete} />
			I understand this cannot be undone.
		</label>
		<form method="POST" action="?/deleteAccount" class="mt-4">
			<button class="btn bg-recipe-red font-bold text-recipe-red-ink disabled:opacity-40" type="submit" disabled={!confirmDelete}>Permanently delete my account</button>
		</form>
	</section>
</main>
