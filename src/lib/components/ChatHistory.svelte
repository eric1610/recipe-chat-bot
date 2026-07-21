<script lang="ts">
	let { labelledBy }: { labelledBy?: string } = $props();
</script>

<div class="flex h-full min-h-0 flex-col" aria-labelledby={labelledBy}>
	<div class="border-b border-surface-300-700 p-4">
		<button class="btn w-full preset-tonal-primary font-bold" type="button" disabled>
			<span aria-hidden="true">＋</span>
			New conversation
		</button>
	</div>

	<div class="flex min-h-0 flex-1 flex-col p-4">
		<p class="mb-3 text-xs font-bold tracking-[0.14em] text-surface-600-400 uppercase">
			Recent chats
		</p>

		<div
			class="grid flex-1 place-items-center rounded-container border border-dashed border-surface-400-600 bg-surface-100-900/60 p-6 text-center"
		>
			<div class="max-w-48">
				<span
					class="mx-auto grid size-12 place-items-center rounded-full bg-secondary-500/20 text-xl text-secondary-700-300"
					aria-hidden="true"
					>☰</span
				>
				<p class="mt-4 font-bold text-surface-950-50">No conversations yet</p>
				<p class="mt-2 text-sm leading-6 text-surface-700-300">
					Your saved recipe chats will appear here once secure chat is connected.
				</p>
			</div>
		</div>
	</div>

	<p class="border-t border-surface-300-700 p-4 text-xs leading-5 text-surface-600-400">
		Conversation history is not stored in this preview.
	</p>
</div>
