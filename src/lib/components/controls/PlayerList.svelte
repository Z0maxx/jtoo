<script lang="ts">
	import type { SteamID3 } from '$lib/types.svelte';
	import type { LeaderboardEntry } from '$lib/websockets/console/live-types';

	// a player picker as one row per player, all the same width: a fixed column for the race
	// marker, then the name, cut short if it doesn't fit

	type Props = {
		players: SteamID3[];
		value: SteamID3 | undefined;
		label: (sId3: SteamID3) => string;
		// the race's entries, to mark who has finished or is out; empty to mark no one
		entries?: Map<SteamID3, LeaderboardEntry>;
	};

	let { players, value = $bindable(), label, entries = new Map() }: Props = $props();

	const name = $props.id();

	const isOut = (e: LeaderboardEntry | undefined) =>
		e?.status === 'disqualified' || e?.status === 'withdrawn';
</script>

<div class="grid gap-1">
	{@render row(undefined)}
	{#each players as sId3 (sId3)}
		{@render row(sId3)}
	{/each}
</div>

{#snippet row(sId3: SteamID3 | undefined)}
	{@const entry = sId3 === undefined ? undefined : entries.get(sId3)}
	{@const finished = entry?.status === 'finished'}
	{@const rowLabel = sId3 === undefined ? 'none' : label(sId3)}
	<!-- finished and out players are dimmed, unless selected, so the running ones stand out -->
	<label
		class="button button-option grid cursor-pointer grid-cols-[2.5rem_1fr] items-center text-left select-none
			{finished || isOut(entry) ? 'opacity-60 has-checked:opacity-100' : ''}"
		title={rowLabel}
	>
		<!-- visually hidden, not display:none, so the list works with the keyboard -->
		<input type="radio" class="sr-only" {name} bind:group={value} value={sId3} />
		<span class="flex items-center gap-1 text-sm">
			{#if sId3 === undefined}
				✖
			{:else if finished}
				<span class="icon-[mdi--flag-checkered] shrink-0" aria-hidden="true"></span>
				<span>{entry!.position}</span>
				<span class="sr-only">finished</span>
			{:else if isOut(entry)}
				DNF
			{/if}
		</span>
		<span class="truncate">{rowLabel}</span>
	</label>
{/snippet}
