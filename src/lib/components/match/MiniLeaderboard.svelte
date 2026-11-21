<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { fade } from 'svelte/transition';
	import { getPlayer, msToFormattedTime, msToGap, playerLabel } from '$lib/util';
	import { settings } from '$lib/storage.svelte';
	import { getContext } from 'svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import type { LeaderboardEntry } from '$lib/websockets/console/live-types';

	type Props = { class?: string };
	let { class: styleClass }: Props = $props();

	let live: ConsoleLive = getContext('consoleLive');

	const maxPlayers = 8;
	const maxNameLength = 12;

	const isOut = (e: LeaderboardEntry) => e.status === 'disqualified' || e.status === 'withdrawn';
	const hasProgress = (e: LeaderboardEntry) =>
		e.prMs !== null || e.bestProgress.checkpointCount > 0;

	// players with a PR or progress, in the console's order, then disqualified and withdrawn
	// players at the bottom
	let rows = $derived.by(() => {
		const board = live.currentRace?.leaderboard ?? [];
		const racing = board.filter((e) => !isOut(e) && hasProgress(e));
		const out = board.filter(isOut);
		return [...racing, ...out].slice(0, maxPlayers);
	});

	function gap(entry: LeaderboardEntry, i: number): string {
		if (isOut(entry)) return entry.status === 'disqualified' ? 'DQ' : 'WD';
		if (i == 0) return entry.prMs !== null ? msToFormattedTime(entry.prMs) : '--';
		return entry.gapToLeaderMs !== null ? msToGap(entry.gapToLeaderMs) : '--';
	}
</script>

{#if rows.length > 0}
	<section class="{styleClass} absolute top-0 left-0 z-20 p-2" transition:fade>
		<div class="grid grid-cols-[repeat(4,auto)] gap-x-2 gap-y-0 text-xl *:m-0 *:p-0">
			{#each rows as entry, i (entry.steamId3)}
				{@render Row(entry, i)}
			{/each}
		</div>
		<!-- background -->
		<div
			class="absolute top-0 left-0 -z-1 h-full w-full rounded-md bg-[#0f0f16] opacity-90"
			style:filter={getFiltersStyle()}
		></div>
	</section>
{/if}

{#snippet Row(entry: LeaderboardEntry, i: number)}
	{@const player = getPlayer(entry.steamId3)}
	{@const out = isOut(entry)}
	<!-- position -->
	<div class={out ? 'opacity-40' : ''}>{out ? '-' : i + 1}</div>
	<!-- avatar -->
	<div class={out ? 'opacity-40' : ''}>
		{#if player.avatarURL}
			<img
				in:fade
				src={player.avatarURL}
				alt=""
				class="size-7 rounded-md object-cover object-center"
				draggable="false"
			/>
		{/if}
	</div>
	<!-- name -->
	<div class={out ? 'line-through opacity-40' : ''}>
		{playerLabel(entry.steamId3, maxNameLength)}
	</div>
	<!-- gap -->
	<div class="w-full min-w-20 text-end {settings.current.monoFont} {out ? 'opacity-40' : ''}">
		{gap(entry, i)}
	</div>
	<hr class="hr m-1!" />
{/snippet}
