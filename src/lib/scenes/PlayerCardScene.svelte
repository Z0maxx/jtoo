<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import SceneFrame from '$lib/components/scene/SceneFrame.svelte';
	import SceneHeader from '$lib/components/scene/SceneHeader.svelte';
	import Flag from '$lib/components/util/Flag.svelte';
	import { overlay, settings } from '$lib/storage.svelte';
	import { csToFormattedTime, getMap, getPlayer, secondsToCs } from '$lib/util';
	import { poolMaps } from '$lib/console-pools.svelte';
	import { mapName, seriesOf, teamText, type Actor } from '$lib/map-picks';
	import type { Player } from '$lib/types.svelte';
	import type { KSNWebSocket } from '$lib/websockets/ksn/ws-ksn.svelte';
	import { getContext, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Tween } from 'svelte/motion';
	import { cubicInOut, cubicOut, linear } from 'svelte/easing';

	const EVENT_NAME = 'Jump4Charity';
	// a bar is the gap as a share of the faster time, scaled so the biggest gap is this much of
	// its side, and never shorter than the min so a tiny gap still shows whose side it's on
	const BAR_MAX_PERCENT = 90;
	const BAR_MIN_PERCENT = 4;
	// the gap is written inside a bar at least this long, and just past its end otherwise
	const BAR_LABEL_INSIDE_PERCENT = 20;
	// switching to the scene grows the bars out from the middle, a row after the one above. its
	// own settings, tuned apart from the rocket bar's fill in
	const BAR_GROW = { duration: 4500, easing: cubicOut };
	const BAR_GROW_STAGGER_MS = 10;

	// one clock for the whole entrance, in ms since the scene appeared, run at an even pace: each
	// row eases its own stretch of it, starting a stagger after the row above
	const growClock = new Tween(0, { duration: 0, easing: cubicOut });
	let growTotal = $state(0);
	onMount(() => {
		growTotal = BAR_GROW.duration + BAR_GROW_STAGGER_MS * rows.length;
		growClock.set(growTotal, { duration: growTotal });
	});
	// until the clock runs out, bars follow it; after, they slide to changes at their usual speed
	let entering = $derived(growClock.current < growTotal || growTotal === 0);

	// how far a row's bar has grown, 0 to 1
	function grown(index: number): number {
		const t = (growClock.current - index * BAR_GROW_STAGGER_MS) / BAR_GROW.duration;
		return BAR_GROW.easing(Math.min(1, Math.max(0, t)));
	}

	let ksnWs: KSNWebSocket = getContext('ksnWs');

	// players A and B as picked in the controls: A on the left in blue, B on the right in red
	let players: Record<Actor, Player> = $derived({
		A: getPlayer(overlay.current.players[0]),
		B: getPlayer(overlay.current.players[1])
	});
	let tfClass = $derived(settings.current.tfClass ?? 'soldier');
	// map runs are only kept for soldier and demoman
	let runClass: 'soldier' | 'demoman' = $derived(tfClass === 'demoman' ? 'demoman' : 'soldier');

	// MARK: picks
	// the pick & ban session's picks, by map file name, with the map left over as the decider.
	// its players are matched to A and B by steam id, since the session's A and B needn't be
	// the controls' A and B
	let picks = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
		const byMap = new Map<string, { side: Actor | 'decider' }>();
		const session = ksnWs.messages.mapPicks?.session;
		if (!session || session.status === 'cancelled') return byMap;
		const sideOf = (actor: Actor): Actor | undefined => {
			const id = Number(session[`player${actor}`].steamId3.match(/\d+(?=\]?$)/)?.[0]);
			return id === players.A.steamID3 ? 'A' : id === players.B.steamID3 ? 'B' : undefined;
		};
		for (const { mapId, actor } of seriesOf(session)) {
			const file = session.maps.find((m) => m.id === mapId)?.name;
			// the series has no actor for the decider
			const side = actor ? sideOf(actor) : 'decider';
			if (file && side) byMap.set(file, { side });
		}
		return byMap;
	});

	// MARK: map rows
	type Run = { seconds: number; rank: number } | undefined;
	let rows = $derived(
		poolMaps()
			.map((fileName) => getMap(fileName))
			.filter((map) => map.fileName)
			.map((map) => {
				const runs = map.runs?.[runClass] ?? [];
				const runOf = (p: Player): Run => {
					const run = p.tempusID ? runs.find((r) => r.tempusID === p.tempusID) : undefined;
					return run && { seconds: run.duration, rank: run.rank };
				};
				const a = runOf(players.A);
				const b = runOf(players.B);
				// the faster player, when both have a PR
				const faster: Actor | undefined = a && b ? (a.seconds <= b.seconds ? 'A' : 'B') : undefined;
				const gap = a && b ? Math.abs(a.seconds - b.seconds) : 0;
				const share = a && b ? gap / Math.min(a.seconds, b.seconds) : 0;
				return { map, runs: { A: a, B: b }, faster, gap, share, pick: picks.get(map.fileName) };
			})
	);
	let maxShare = $derived(Math.max(0, ...rows.map((r) => r.share)));

	function barPercent(share: number): number {
		if (!maxShare) return BAR_MIN_PERCENT;
		return Math.max(BAR_MIN_PERCENT, Math.round((share / maxShare) * BAR_MAX_PERCENT));
	}

	function formatTime(seconds: number): string {
		return csToFormattedTime(secondsToCs(seconds));
	}

	// while a pick & ban session has picks, the maps not picked are dimmed, bars and all
	let picksActive = $derived(picks.size > 0);

	// the decider, picked by neither player, is neutral
	const teamRing: Record<Actor | 'decider', string> = {
		A: 'ring-ctp-blue',
		B: 'ring-ctp-red',
		decider: 'ring-ctp-subtext1'
	};
	const teamBar: Record<Actor, string> = { A: 'bg-ctp-blue', B: 'bg-ctp-red' };
</script>

<SceneFrame class="gap-8">
	<SceneHeader eventName={EVENT_NAME} title="Head to Head" />

	{#if !players.A.name && !players.B.name}
		<p class="text-3xl text-ctp-subtext0 italic" style:filter={getFiltersStyle()}>
			pick players A and B in the controls
		</p>
	{:else}
		<!-- the players sit over their side of the chart -->
		<div class="grid grid-cols-[minmax(0,1fr)_20rem_minmax(0,1fr)] items-center gap-6">
			{@render PlayerInfo('A')}
			<span></span>
			{@render PlayerInfo('B')}
		</div>

		<!-- each pool map's gap as a bar out from the middle column, towards whoever is faster -->
		<div class="flex min-h-0 flex-1 flex-col gap-2.5">
			{#each rows as row, i (row.map.fileName)}
				<!-- no gap between the bar tracks and the map tile, so the bars start at its edges -->
				<div
					class="grid min-h-0 flex-1 grid-cols-[12rem_minmax(0,1fr)_20rem_minmax(0,1fr)_12rem] items-center"
				>
					{@render Time(row, 'A')}
					{@render Bar(row, 'A', i)}

					<div
						class="relative isolate flex h-full items-center justify-center overflow-hidden rounded-[0.875rem] px-3.5 transition-[filter,box-shadow] duration-500"
						class:brightness-50={picksActive && !row.pick}
					>
						{#if row.map.imageURL}
							<img
								in:fade
								src={row.map.imageURL}
								alt=""
								class="absolute inset-0 -z-20 size-full object-cover"
								draggable="false"
							/>
						{/if}
						<div class="absolute inset-0 -z-10 bg-ctp-crust/60"></div>
						<span class="truncate text-2xl font-bold text-white uppercase">
							{mapName(row.map.fileName)}
						</span>
						<!-- the outline on its own layer over the image: a tile's own inset ring is drawn
						     under its children, and an outer one would run into the bars beside it -->
						<div
							class="pointer-events-none absolute inset-0 rounded-[0.875rem] ring-inset {row.pick
								? `ring-3 ${teamRing[row.pick.side]}`
								: 'ring-2 ring-ctp-lavender/25'}"
							style:filter={row.pick ? undefined : getFiltersStyle()}
						></div>
					</div>

					{@render Bar(row, 'B', i)}
					{@render Time(row, 'B')}
				</div>
			{/each}
		</div>
	{/if}
</SceneFrame>

<!-- a player's avatar, name and flag, with their stats in the same order on both sides -->
{#snippet PlayerInfo(side: Actor)}
	{@const player = players[side]}
	{@const rank = player.rank?.[tfClass]}
	{@const right = side === 'B'}
	<div class="flex min-w-0 items-center gap-6 {right ? 'flex-row-reverse text-right' : ''}">
		{#if player.name}
			{#if settings.current.enableAvatars}
				{#if player.avatarURL}
					<img
						in:fade
						src={player.avatarURL}
						alt=""
						class="size-34 shrink-0 rounded-3xl object-cover ring-4 {teamRing[side]}"
						draggable="false"
					/>
				{:else}
					<span class="size-30 shrink-0 rounded-3xl ring-5 {teamRing[side]}">
						<!-- tinted on its own, so the team ring keeps its colour -->
						<span
							class="flex size-full items-center justify-center rounded-3xl bg-ctp-lavender/15 text-6xl font-bold text-ctp-lavender uppercase"
							style:filter={getFiltersStyle()}
						>
							{player.name[0]}
						</span>
					</span>
				{/if}
			{/if}
			<div class="flex min-w-0 flex-col gap-1.5 {right ? 'items-end' : ''}">
				<span class="flex max-w-full items-center gap-3.5 {right ? 'flex-row-reverse' : ''}">
					{#if settings.current.enableFlags && player.flag}
						<Flag code={player.flag} class="shrink-0 rounded-sm text-5xl" />
					{/if}
					<span class="truncate text-[3.5rem] leading-none font-bold uppercase {teamText[side]}">
						{player.name}
					</span>
				</span>
				<!-- stats come from Tempus and Tempus Plaza, and aren't there for every player -->
				<span
					class="flex gap-5.5 text-[1.375rem] text-ctp-subtext0"
					style:filter={getFiltersStyle()}
				>
					{@render Stat(rank?.rank ? `#${rank.rank}` : '–', tfClass)}
					{@render Stat(`${player.WRs?.[tfClass] ?? '–'}`, 'WRs')}
					{@render Stat(`${player.TTs?.[tfClass] ?? '–'}`, 'TTs')}
				</span>
				<span class="text-xl text-ctp-subtext0" style:filter={getFiltersStyle()}>
					{[
						rank?.title,
						rank?.points ? `${rank.points.toLocaleString('en-US')} points` : '',
						player.rank?.overall?.rank ? `#${player.rank.overall.rank} overall` : ''
					]
						.filter(Boolean)
						.join(' · ')}
				</span>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet Stat(value: string, label: string)}
	<span>
		<span class="text-[1.75rem] font-bold text-white {settings.current.monoFont}">{value}</span>
		{label}
	</span>
{/snippet}

<!-- a player's PR on the map and their rank on it, lit in their colour when they're faster -->
{#snippet Time(row: (typeof rows)[number], side: Actor)}
	{@const run = row.runs[side]}
	<!-- faded with the map's tile and bar while picks are active and it isn't picked -->
	<div
		class="flex flex-col transition-opacity duration-500 {side === 'B'
			? 'items-end'
			: 'items-start'}"
		class:opacity-50={picksActive && !row.pick}
	>
		<span
			class="text-3xl font-bold {settings.current.monoFont} {!run
				? 'text-ctp-overlay0'
				: row.faster === side
					? teamText[side]
					: 'text-ctp-subtext1'}"
			style:filter={run && row.faster === side ? undefined : getFiltersStyle()}
		>
			{run ? formatTime(run.seconds) : 'no PR'}
		</span>
		{#if run}
			<span class="text-[1.0625rem] text-ctp-subtext0" style:filter={getFiltersStyle()}
				>Rank #{run.rank}</span
			>
		{/if}
	</div>
{/snippet}

<!-- only the faster player gets a bar; the gap sits inside it when it fits, else past its end -->
{#snippet Bar(row: (typeof rows)[number], side: Actor, index: number)}
	{@const pct = barPercent(row.share)}
	{@const inside = pct >= BAR_LABEL_INSIDE_PERCENT}
	{@const label = `−${row.gap.toFixed(2)}`}
	<div
		class="flex h-full items-center gap-3 transition-[filter] duration-500 {side === 'A'
			? 'flex-row-reverse justify-start'
			: ''}"
		class:brightness-60={picksActive && !row.pick}
		class:opacity-80={picksActive && !row.pick}
	>
		{#if row.faster === side}
			<!-- clipped, so the gap inside doesn't spill out while the bar grows. the width
			     follows the entrance clock every frame, so the css slide only joins in after -->
			<span
				class="flex h-7.5 shrink-0 items-center overflow-hidden px-3 text-[1.3125rem] font-bold whitespace-nowrap text-ctp-crust {entering
					? ''
					: 'transition-[width] duration-700'} {teamBar[side]} {side === 'A'
					? 'justify-start rounded-l-lg'
					: 'justify-end rounded-r-lg'} {settings.current.monoFont}"
				style:width="{pct * grown(index)}%"
			>
				{inside ? label : ''}
			</span>
			{#if !inside}
				<span
					class="text-[1.3125rem] font-bold whitespace-nowrap text-white {settings.current
						.monoFont}"
				>
					{label}
				</span>
			{/if}
		{/if}
	</div>
{/snippet}
