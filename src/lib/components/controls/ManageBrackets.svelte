<script lang="ts">
	import { items, overlay } from '$lib/storage.svelte';
	import type { SavedBracket } from '$lib/types.svelte';
	import EditBracket from './EditBracket.svelte';
	import PopOver from './PopOver.svelte';

	let popoverState: 'open' | 'closed' = $state('closed');

	function deleteBracket(bracket: SavedBracket) {
		items.current.brackets = (items.current.brackets ?? []).filter((b) => b.id !== bracket.id);
		if (overlay.current.bracket == bracket.id) overlay.current.bracket = '';
	}
</script>

<PopOver title="manage brackets" bind:state={popoverState}>
	<div class="grid w-full grid-cols-[1fr_max-content_max-content_max-content] items-center gap-x-4">
		{#each items.current.brackets ?? [] as bracket (bracket.id)}
			<div>{bracket.name}</div>
			<div class="opacity-60">{bracket.size} players</div>
			<div><EditBracket {bracket} /></div>
			<div>
				<button class="button-remove" onclick={() => deleteBracket(bracket)}>delete</button>
			</div>
		{/each}
	</div>
</PopOver>
