<script lang="ts">
	import { formatOf, type MatchDef, type Source } from '$lib/Bracket.svelte';
	import type { BracketSize, Elimination, SteamID3 } from '$lib/types.svelte';
	import { getPlayer } from '$lib/util';
	import { flip } from 'svelte/animate';

	// The first match each seed plays, top to bottom as the bracket is drawn.
	// Dragging a player onto another swaps their seeds.
	type Props = {
		size: BracketSize;
		elimination?: Elimination;
		players: SteamID3[]; // seeding order: seed 1 first
		onchange?: () => void;
		class?: string;
	};
	let { size, elimination, players = $bindable(), onchange, class: styleClass }: Props = $props();

	// the grid rows of each starting match (two rows each, one per spot),
	// with a row for a divider between each round
	let layout = $derived.by(() => {
		const matches: { match: MatchDef; row: number }[] = [];
		const dividers: number[] = [];
		let row = 1;
		for (const round of formatOf({ size, elimination }).upper) {
			const starting = round.matches.filter((m) => 'seed' in m.A || 'seed' in m.B);
			if (!starting.length) continue;
			if (matches.length) dividers.push(row++);
			for (const match of starting) {
				matches.push({ match, row });
				row += 2;
			}
		}
		return { matches, dividers };
	});

	// each match's two spots, top to bottom
	let spots = $derived(
		layout.matches.flatMap(({ match, row }) => [
			{ match, side: 'A' as const, source: match.A, row },
			{ match, side: 'B' as const, source: match.B, row: row + 1 }
		])
	);

	// a player spot is tied to its player, so it slides when they move
	function spotKey(spot: (typeof spots)[number]) {
		return 'seed' in spot.source ? players[spot.source.seed - 1] : `${spot.match.id}.${spot.side}`;
	}

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

<!-- every spot is in one keyed list, placed on the grid by row, so a player's spot can slide
     to its new place when seeds are swapped, even into another match -->
<div class="grid grid-cols-12 gap-x-2 bg-obs-background {styleClass}">
	{#each layout.matches as { match, row } (match.id)}
		<div class="col-span-2 self-center opacity-60" style:grid-row="{row} / span 2">
			{match.id}
		</div>
	{/each}
	{#each layout.dividers as row (row)}
		<div class="col-span-full mb-2 h-0.5 bg-obs-padding" style:grid-row={row}></div>
	{/each}
	{#each spots as spot, i (spotKey(spot))}
		<div
			class="col-span-10 col-start-3 {spot.side == 'B' && i < spots.length - 1 ? 'mb-2' : ''}"
			style:grid-row={spot.row}
			animate:flip={{ duration: 150 }}
		>
			{@render Entry(spot.source)}
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
