<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { fade } from 'svelte/transition';
	import { getPlayer, msToFormattedTime, msToGap, playerLabel } from '$lib/util';
	import { settings } from '$lib/storage.svelte';
	import { getContext } from 'svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import type { LeaderboardEntry, RaceSnapshot } from '$lib/websockets/console/live-types';
	import {
		massSingleOrder,
		progressOrder,
		type JFRelayWebSocket
	} from '$lib/websockets/jf-relay/js-relay.svelte';

	// fills the height it's given, with room for maxPlayers rows
	// translucent: a fainter background, for over a pov
	type Props = { class?: string; translucent?: boolean };
	let { class: styleClass = '', translucent = false }: Props = $props();

	let live: ConsoleLive = getContext('consoleLive');
	// optional: without it, single run races keep the console's order
	let jfRelayWs: JFRelayWebSocket | undefined = getContext('jfRelayWs');

	const maxPlayers = 8;

	type Row = {
		entry: LeaderboardEntry;
		out: boolean; // disqualified or withdrawn, shown as DNF
		value: string;
		// how far through the map, 0 to 1, for single run races; null hides the bar
		progress: number | null;
		running: boolean;
	};

	const isOut = (e: LeaderboardEntry) => e.status === 'disqualified' || e.status === 'withdrawn';
	const time = (ms: number | null) => (ms !== null ? msToFormattedTime(ms) : '--');
	const gap = (ms: number | null) => (ms !== null ? msToGap(ms) : '--');
	const reached = (splits: (number | null)[]) => splits.filter((s) => s !== null).length;

	let race = $derived(live.currentRace);
	let singleRun = $derived(race?.mode === 'mass-single');

	// single run races: finished players by position, then the running players by map progress,
	// then DNF. Players who haven't started are left out
	function singleRunRows(race: RaceSnapshot): Row[] {
		const board = race.leaderboard;
		const total = race.checkpoints.length;
		const byId = new Map(board.map((e) => [e.steamId3, e]));
		const ordered = jfRelayWs
			? massSingleOrder(board, jfRelayWs.progress).map((id) => byId.get(id)!)
			: [...board].sort((a, b) => a.position - b.position);
		const relayRunning = new Set(jfRelayWs ? progressOrder(jfRelayWs.progress) : []);
		const started = (e: LeaderboardEntry) =>
			e.status === 'finished' ||
			e.status === 'running' ||
			e.bestProgress.checkpointCount > 0 ||
			relayRunning.has(e.steamId3);

		const racing = ordered.filter((e) => !isOut(e) && started(e));
		const leader = racing.find((e) => e.status === 'finished');
		return [...racing, ...ordered.filter(isOut)].slice(0, maxPlayers).map((entry) => {
			const out = isOut(entry);
			const finished = entry.status === 'finished';
			const running = entry.status === 'running';
			const checkpoints = running
				? reached(entry.currentSplitsMs)
				: entry.bestProgress.checkpointCount;
			let value = '';
			if (out) value = 'DNF';
			else if (finished) value = entry === leader ? time(entry.prMs) : gap(entry.gapToLeaderMs);
			return {
				entry,
				out,
				value,
				progress: finished ? 1 : total ? Math.min(checkpoints / total, 1) : 0,
				running
			};
		});
	}

	// time attack races (and duels): only players with a completed run, by position
	function timeAttackRows(race: RaceSnapshot): Row[] {
		return race.leaderboard
			.filter((e) => !isOut(e) && e.prMs !== null)
			.sort((a, b) => a.position - b.position)
			.slice(0, maxPlayers)
			.map((entry, i) => ({
				entry,
				out: false,
				value: i === 0 ? time(entry.prMs) : gap(entry.gapToLeaderMs),
				progress: null,
				running: entry.status === 'running'
			}));
	}

	let rows = $derived(!race ? [] : singleRun ? singleRunRows(race) : timeAttackRows(race));

	function barColor(row: Row): string {
		if (row.out) return 'bg-ctp-overlay0';
		if (row.entry.status === 'finished') return 'bg-ctp-lavender';
		return row.running ? 'bg-ctp-green' : 'bg-ctp-overlay0';
	}
</script>

<!-- duels don't need a leaderboard -->
{#if race && race.mode !== 'duel'}
	<section class="{styleClass} relative isolate flex flex-col px-4 pt-3 pb-3.5" transition:fade>
		<!-- background -->
		<div
			class="absolute inset-0 -z-1 rounded-[10px] ring-1 ring-ctp-lavender/20 ring-inset {translucent
				? 'bg-[#0f0f16]/55'
				: 'bg-[#0f0f16]/92'}"
			style:filter={getFiltersStyle()}
		></div>
		<div
			class="mb-1 flex justify-between border-b border-ctp-lavender/20 px-0.5 pb-2 text-sm font-medium tracking-[0.08em] text-ctp-overlay2 uppercase"
		>
			<span>Leaderboard</span>
			<span>{singleRun ? 'run / gap' : 'pr / gap'}</span>
		</div>
		<div class="grid min-h-0 flex-1 grid-rows-8">
			{#each rows as row, i (row.entry.steamId3)}
				{@render Row(row, i)}
			{/each}
		</div>
	</section>
{/if}

{#snippet Row(row: Row, i: number)}
	{@const lead = i === 0 && !row.out}
	{@const avatar = getPlayer(row.entry.steamId3).avatarURL}
	<div
		class="flex min-w-0 items-center gap-3 rounded-md px-1.5
        {lead ? 'bg-ctp-lavender/14' : ''} 
        {row.out ? 'opacity-45' : ''}"
	>
		<!-- position -->
		<span
			class="w-5.5 shrink-0 text-right text-xl font-bold {lead
				? 'text-ctp-lavender'
				: 'text-ctp-overlay2'}">{row.out ? '–' : i + 1}</span
		>
		<!-- avatar -->
		{#if settings.current.enableAvatars}
			{#if avatar}
				<img
					src={avatar}
					alt=""
					class="size-7.5 shrink-0 rounded-[7px] object-cover"
					draggable="false"
				/>
			{:else}
				<span class="size-7.5 shrink-0 rounded-[7px] bg-ctp-surface0"></span>
			{/if}
		{/if}
		<!-- name, cut off with an ellipsis when it doesn't fit -->
		<span
			class="truncate text-[22px] font-medium
            {row.progress === null ? 'min-w-0 flex-1' : 'w-26 shrink-0'}
            {row.out ? 'line-through' : ''}"
		>
			{playerLabel(row.entry.steamId3)}
		</span>
		<!-- progress through the map -->
		{#if row.progress !== null}
			<div class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ctp-lavender/12">
				<div
					class="h-full rounded-full transition-[width] duration-700 {barColor(row)}"
					style:width="{row.progress * 100}%"
				></div>
			</div>
		{/if}
		<!-- time, gap or DNF -->
		<span class="w-27 shrink-0 text-right text-xl {settings.current.monoFont}">
			{row.value}
		</span>
	</div>
{/snippet}
