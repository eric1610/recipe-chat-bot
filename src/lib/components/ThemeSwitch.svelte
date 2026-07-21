<script lang="ts">
	import { Switch } from '@skeletonlabs/skeleton-svelte';

	const storageKey = 'recipe-chat-bot-color-mode';
	let checked = $state(false);

	function readSavedMode(): 'light' | 'dark' | null {
		try {
			const mode = localStorage.getItem(storageKey);
			return mode === 'light' || mode === 'dark' ? mode : null;
		} catch {
			return null;
		}
	}

	function applyMode(mode: 'light' | 'dark') {
		document.documentElement.dataset.mode = mode;
		checked = mode === 'dark';
	}

	$effect(() => {
		const media = window.matchMedia('(prefers-color-scheme: dark)');
		const savedMode = readSavedMode();
		applyMode(savedMode ?? (media.matches ? 'dark' : 'light'));

		const onSystemModeChange = (event: MediaQueryListEvent) => {
			if (!readSavedMode()) applyMode(event.matches ? 'dark' : 'light');
		};

		media.addEventListener('change', onSystemModeChange);
		return () => media.removeEventListener('change', onSystemModeChange);
	});

	function onCheckedChange(event: { checked: boolean }) {
		const mode = event.checked ? 'dark' : 'light';

		try {
			localStorage.setItem(storageKey, mode);
		} catch {
			// Mode still changes for this visit when storage is unavailable.
		}

		applyMode(mode);
	}
</script>

<Switch
	{checked}
	{onCheckedChange}
	class="group flex cursor-pointer items-center gap-2 text-sm font-semibold text-surface-950-50"
>
	<Switch.Label class="hidden sm:inline">Dark mode</Switch.Label>
	<Switch.Control
		class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-surface-300-700 p-1 ring-1 ring-surface-400-600 transition-colors group-focus-within:outline-3 group-focus-within:outline-offset-4 group-focus-within:outline-secondary-500 group-data-[state=checked]:bg-primary-500"
	>
		<Switch.Thumb
			class="grid size-5 translate-x-0 place-items-center rounded-full bg-surface-50 text-[0.65rem] text-surface-950 shadow-sm transition-transform data-[state=checked]:translate-x-5"
		>
			<span aria-hidden="true">{checked ? '☾' : '☀'}</span>
		</Switch.Thumb>
	</Switch.Control>
	<Switch.HiddenInput />
</Switch>
