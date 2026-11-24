<script lang="ts">
	import { formats, type Source } from '$lib/Bracket.svelte';
	import type { BracketSize, SteamID3 } from '$lib/types.svelte';
	import { getPlayer } from '$lib/util';

	// The first match each seed plays, top to bottom as the bracket is drawn.
	// Dragging a player onto another swaps their seeds.
	type Props = {
		size: BracketSize;
		players: SteamID3[]; // seeding order: seed 1 first
		onchange?: () => void;
		class?: string;
	};
	let { size, players = $bindable(), onchange, class: styleClass }: Props = $props();

	let matches = $derived(
		formats[size].upper
			.flatMap((round) => round.matches)
			.filter((m) => 'seed' in m.A || 'seed' in m.B)
	);

	// seeds being dragged and dragged over
	let dragged = $state(0);
	let target = $state(0);

	function swapSeeds(a: number, b: number) {
		if (!a || !b || a == b) return;
		const next = [...players];
		[next[a - 1], next[b - 1]] = [next[b - 1], next[a - 1]];
		players = next;
		onchange?.();
	}
</script>

<div class="flex flex-col gap-2 bg-obs-background {styleClass}">
	{#each matches as match (match.id)}
		<div class="grid grid-cols-12 items-center gap-2">
			<div class="col-span-2 opacity-60">{match.id}</div>
			<div class="col-span-10 flex flex-col">
				{@render Entry(match.A)}
				{@render Entry(match.B)}
			</div>
		</div>
	{/each}
</div>

{#snippet Entry(source: Source)}
	{#if 'seed' in source}
		{@const seed = source.seed}
		{@const player = getPlayer(players[seed - 1])}
		<div
			class="flex min-h-12 cursor-grab items-center gap-4 bg-obs-padding p-1
				{dragged == seed ? 'opacity-40' : ''}
				{dragged && target == seed && dragged != seed
				? 'outline-2 -outline-offset-2 outline-ctp-lavender-400'
				: ''}"
			role="listitem"
			draggable={true}
			ondragstart={() => (dragged = seed)}
			ondragenter={() => (target = seed)}
			ondragover={(e) => e.preventDefault()}
			ondrop={() => swapSeeds(dragged, seed)}
			ondragend={() => (dragged = target = 0)}
		>
			<span class="w-6 text-right opacity-60">{seed}</span>
			{#if player.avatarURL}
				<img
					src={player.avatarURL}
					alt=""
					class="size-10 rounded-xl object-cover object-center"
					draggable="false"
				/>
			{/if}
			<span>{player.name}</span>
		</div>
	{:else}
		<!-- the same size as a player spot, in a lighter shade, as it can't be dragged -->
		<div class="flex min-h-12 items-center gap-4 bg-obs-padding/50 p-1">
			<span class="w-6"></span>
			<span class="opacity-60">
				{'winnerOf' in source ? `winner of ${source.winnerOf}` : `loser of ${source.loserOf}`}
			</span>
		</div>
	{/if}
{/snippet}
