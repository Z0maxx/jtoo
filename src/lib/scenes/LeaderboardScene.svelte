<script lang="ts">
	import SceneFrame from '$lib/components/scene/SceneFrame.svelte';
	import SceneHeader from '$lib/components/scene/SceneHeader.svelte';
	import SceneTag from '$lib/components/scene/SceneTag.svelte';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { overlay, settings } from '$lib/storage.svelte';
	import { fade } from 'svelte/transition';
	import { getContext } from 'svelte';
	import { fitText } from '$lib/fit-text';
	import { getMap, getPlayer, msToFormattedTime, msToGap, playerLabel } from '$lib/util';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import type {
		RoundResultEntry,
		SteamID3,
		TournamentRound
	} from '$lib/websockets/console/live-types';

	const EVENT_NAME = 'Jump4Charity';
	// as many rows as fit under the header at 1080p
	const MAX_ROWS = 8;
	const TOP_STANDINGS = 5;
	// the console's points by placement (jf-console backend/live/standings.ts): 1st gets 40,
	// 20th gets 1, 21st and below get 0. every result scores by its placement, DQs included
	const RJR_POINTS = [40, 30, 25, 22, 20, 18, 16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

	// gold, silver and bronze
	const medals = {
		1: {
			text: 'text-ctp-yellow',
			ring: 'ring-ctp-yellow',
			border: 'border-ctp-yellow',
			bg: 'bg-ctp-yellow/15'
		},
		2: {
			text: 'text-ctp-subtext1',
			ring: 'ring-ctp-subtext1',
			border: 'border-ctp-subtext1',
			bg: 'bg-ctp-subtext1/15'
		},
		3: {
			text: 'text-ctp-peach',
			ring: 'ring-ctp-peach',
			border: 'border-ctp-peach',
			bg: 'bg-ctp-peach/15'
		}
	} as const;
	const medalText = (position: number) =>
		position in medals ? medals[position as 1 | 2 | 3].text : 'text-ctp-subtext0';

	let live: ConsoleLive = getContext('consoleLive');

	// MARK: data
	let tournament = $derived(live.tournament);
	let isRjr = $derived(tournament?.scoring === 'rjr-points');
	let rounds = $derived(tournament?.rounds ?? []);
	// rounds that count toward the standings; voided ones were played but don't
	const counts = (round: TournamentRound) => round.finalized && !round.voided;
	let played = $derived(rounds.filter(counts));

	// the board picked in the controls: a round that isn't in this tournament shows the standings
	let view = $derived(overlay.current.leaderboardView ?? 'standings');
	let round = $derived(
		typeof view === 'number' ? played.find((r) => r.roundIndex === view) : undefined
	);
	let board: 'standings' | 'round' | 'final' = $derived(
		round ? 'round' : view === 'final' ? 'final' : 'standings'
	);

	const roundNo = (round: TournamentRound) => round.roundIndex + 1;
	const roundMap = (round: TournamentRound) => round.map || round.stage;
	const winnerOf = (round: TournamentRound) =>
		round.results.find((r) => r.placement === 1)?.steamId3;
	const pointsFor = (placement: number) => RJR_POINTS[placement - 1] ?? 0;

	function formatScore(score: number): string {
		if (!isRjr) return score.toFixed(2);
		return Number.isInteger(score) ? `${score}` : score.toFixed(2);
	}

	// the standings as they were after a round, by the console's rules: points summed, or the
	// average placement with a missed round counting as one behind that round's last place.
	// after the latest round, these are the console's own standings
	function standingsThrough(round: TournamentRound) {
		const counted = rounds.slice(0, rounds.indexOf(round) + 1).filter(counts);
		const players = new Set(counted.flatMap((r) => r.results.map((e) => e.steamId3)));
		return [...players]
			.map((steamId3) => {
				const scores = counted.map((r) => {
					const placement = r.results.find((e) => e.steamId3 === steamId3)?.placement;
					if (isRjr) return placement === undefined ? 0 : pointsFor(placement);
					return placement ?? Math.max(0, ...r.results.map((e) => e.placement)) + 1;
				});
				const total = scores.reduce((a, b) => a + b, 0);
				const score = isRjr ? total : Math.round((total / counted.length) * 100) / 100;
				return { steamId3, score };
			})
			.sort((a, b) => (isRjr ? b.score - a.score : a.score - b.score) || a.steamId3 - b.steamId3)
			.map((s, i) => ({ position: i + 1, ...s }));
	}

	// MARK: header
	let title = $derived(
		board === 'round' && round
			? `Round ${roundNo(round)} Results`
			: board === 'final'
				? 'Final Standings'
				: 'Leaderboard'
	);
	let subtitleText = $derived.by(() => {
		if (!tournament) return '';
		if (board === 'round' && round) return roundMap(round);
		return `${tournament.name}`;
	});
	let scoringLabel = $derived(isRjr ? 'RJR' : 'Avg Placement');

	// MARK: standings (A)
	// the placement columns are the counted rounds; placements line up with tournament.rounds
	let playedColumns = $derived(played.map((r) => rounds.indexOf(r)));
	let standingsColumns = $derived(
		[
			'4rem',
			settings.current.enableAvatars ? '3.5rem' : '',
			'minmax(0, 1fr)',
			`repeat(${played.length}, 4.75rem)`,
			'9.5rem'
		]
			.filter(Boolean)
			.join(' ')
	);

	// MARK: round results (B)
	let resultColumns = $derived(
		[
			'4rem',
			settings.current.enableAvatars ? '3.5rem' : '',
			'minmax(0, 1fr)',
			'15rem',
			'12.5rem',
			isRjr ? '7rem' : ''
		]
			.filter(Boolean)
			.join(' ')
	);
	let leaderPrMs = $derived(round?.results.find((r) => r.prMs !== null)?.prMs ?? null);
	// how many checkpoints the map has is only known while its race is the current one
	let checkpointTotal = $derived(
		round && live.currentRace?.sessionId === round.sessionId
			? live.currentRace.checkpoints.length
			: 0
	);
	const isOut = (e: RoundResultEntry) => e.status === 'disqualified' || e.status === 'withdrawn';

	function gap(entry: RoundResultEntry, i: number): string {
		if (i === 0) return '--';
		if (entry.prMs !== null && leaderPrMs !== null) return msToGap(entry.prMs - leaderPrMs);
		// a disqualified or withdrawn player is a plain DNF
		if (isOut(entry) || !entry.bestProgress.checkpointCount) return '';
		const cp = entry.bestProgress.checkpointCount;
		return checkpointTotal ? `CP ${cp}/${checkpointTotal}` : `CP ${cp}`;
	}

	// MARK: final (D2)
	// the podium reads 2nd, 1st, 3rd from the left
	let podium = $derived(
		[1, 0, 2]
			.map((i) => tournament?.standings[i])
			.filter((s) => s !== undefined)
			.map((s) => ({ ...s, rank: s.position as 1 | 2 | 3 }))
	);
	const podiumBlock = { 1: 'h-75', 2: 'h-55', 3: 'h-40' };
	const podiumLabel = { 1: 'Champion', 2: 'Runner-up', 3: 'Third' };
</script>

<SceneFrame class="gap-10">
	<SceneHeader eventName={EVENT_NAME} {title}>
		{#snippet subtitle()}
			{#if subtitleText}
				<span
					class="truncate text-5xl leading-tight font-bold text-ctp-lavender uppercase"
					style:filter={getFiltersStyle()}
				>
					{subtitleText}
				</span>
			{/if}
		{/snippet}
		{#snippet aside()}
			{#if tournament}
				<div in:fade>
					<SceneTag class="px-6 text-3xl uppercase">
						{scoringLabel}
					</SceneTag>
				</div>
			{/if}
		{/snippet}
	</SceneHeader>

	{#if !tournament}
		<p class="text-3xl text-ctp-subtext0 italic">
			{live.tournamentId ? 'loading tournament...' : 'no tournament'}
		</p>
	{:else}
		{#key board === 'round' ? round?.roundIndex : board}
			<div class="flex min-h-0 flex-1 gap-14" in:fade={{ duration: 400 }}>
				{#if board === 'round' && round}
					{@render RoundBoard(round)}
				{:else if board === 'final'}
					{@render FinalBoard()}
				{:else}
					{@render StandingsBoard()}
				{/if}
			</div>
		{/key}
	{/if}
</SceneFrame>

<!-- MARK: A: standings -->
{#snippet StandingsBoard()}
	<div class="flex min-w-0 flex-1 flex-col gap-3">
		<div
			class="grid items-center gap-x-5 px-6 text-[1.375rem] tracking-[0.16em] text-ctp-subtext0 uppercase"
			style:grid-template-columns={standingsColumns}
		>
			<span></span>
			{#if settings.current.enableAvatars}<span></span>{/if}
			<span>Player</span>
			{#each played as r (r.roundIndex)}
				<span class="text-center">R{roundNo(r)}</span>
			{/each}
			<span class="text-right">{isRjr ? 'Points' : 'Avg'}</span>
		</div>
		<ul class="flex flex-col gap-1.5">
			{#each tournament!.standings.slice(0, MAX_ROWS) as s (s.steamId3)}
				<li
					class="grid items-center gap-x-5 rounded-2xl px-6 py-2.5"
					style:grid-template-columns={standingsColumns}
				>
					{@render Position(s.position, 'text-[2.5rem]')}
					{@render Avatar(s.steamId3, 'size-14 rounded-xl text-[1.75rem]')}
					<span class="truncate text-[2.375rem] text-white">{playerLabel(s.steamId3)}</span>
					{#each playedColumns as column (column)}
						{@const p = s.placements[column]}
						<span class="flex justify-center">
							<span
								class="inline-flex h-11 min-w-12 items-center justify-center rounded-[0.625rem] px-1 text-[1.625rem] font-semibold {settings
									.current.monoFont} {p === 1
									? 'bg-ctp-lavender text-ctp-crust'
									: p === null
										? 'text-ctp-overlay0'
										: 'text-ctp-subtext1'}"
								style:filter={p === 1 ? getFiltersStyle() : undefined}
							>
								{p ?? '–'}
							</span>
						</span>
					{/each}
					<span
						class="text-right text-[2.5rem] font-semibold text-ctp-lavender tabular-nums {settings
							.current.monoFont}"
						style:filter={getFiltersStyle()}
					>
						{formatScore(s.score)}
					</span>
				</li>
			{/each}
		</ul>
	</div>

	<!-- the rounds played so far, styled like the donations milestones -->
	<div class="flex w-[33.75rem] shrink-0 flex-col gap-4">
		<span class="text-2xl tracking-[0.16em] text-ctp-subtext0 uppercase">Rounds</span>
		<ul class="flex min-h-0 flex-col gap-1.5 overflow-hidden">
			{#each played as r (r.roundIndex)}
				{@const winner = winnerOf(r)}
				<li class="flex items-center gap-5 px-4.5 py-2.5">
					<span
						class="w-11 shrink-0 text-3xl font-semibold text-ctp-lavender {settings.current
							.monoFont}"
						style:filter={getFiltersStyle()}
					>
						{roundNo(r)}
					</span>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-3xl leading-tight text-white">{roundMap(r)}</span>
						{#if winner !== undefined}
							<span class="flex items-center gap-2 text-[1.375rem] leading-tight text-ctp-subtext0">
								<span class="icon-[mdi--crown] shrink-0" aria-hidden="true"></span>
								<span class="truncate">{playerLabel(winner)}</span>
							</span>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	</div>
{/snippet}

<!-- MARK: B: round results -->
{#snippet RoundBoard(round: TournamentRound)}
	{@const image = getMap(round.map).imageURL}
	{@const standings = standingsThrough(round).slice(0, TOP_STANDINGS)}
	<div class="flex min-w-0 flex-1 flex-col gap-3">
		<div
			class="grid items-center gap-x-6 px-6 text-[1.375rem] tracking-[0.16em] text-ctp-subtext0 uppercase"
			style:grid-template-columns={resultColumns}
		>
			<span></span>
			{#if settings.current.enableAvatars}<span></span>{/if}
			<span>Player</span>
			<span class="text-right">Time</span>
			<span class="text-right">Gap</span>
			{#if isRjr}<span class="text-right">Pts</span>{/if}
		</div>
		<ul class="flex flex-col gap-1.5">
			{#each round.results.slice(0, MAX_ROWS) as entry, i (entry.steamId3)}
				{@const mono = settings.current.monoFont}
				<li
					class="relative isolate grid items-center gap-x-6 rounded-2xl px-6 py-2.5"
					style:grid-template-columns={resultColumns}
				>
					{#if i === 0}
						<!-- absolute, so it takes no grid cell -->
						<div
							class="absolute inset-0 -z-10 rounded-2xl bg-ctp-lavender/15 ring-2 ring-ctp-lavender/45 ring-inset"
							style:filter={getFiltersStyle()}
						></div>
					{/if}
					{@render Position(entry.placement, 'text-[2.5rem]')}
					{@render Avatar(entry.steamId3, 'size-14 rounded-xl text-[1.75rem]')}
					<span class="truncate text-[2.375rem] text-white" class:font-bold={i === 0}>
						{playerLabel(entry.steamId3)}
					</span>
					<span
						class="text-right text-[2.375rem] font-semibold tabular-nums {mono} {entry.prMs === null
							? 'text-ctp-overlay0'
							: 'text-white'}"
					>
						{entry.prMs === null ? 'DNF' : msToFormattedTime(entry.prMs)}
					</span>
					<span class="text-right text-3xl font-medium text-ctp-subtext0 tabular-nums {mono}">
						{gap(entry, i)}
					</span>
					{#if isRjr}
						<span
							class="text-right text-[2.125rem] font-bold text-ctp-lavender tabular-nums {mono}"
							style:filter={getFiltersStyle()}
						>
							{pointsFor(entry.placement) ? `+${pointsFor(entry.placement)}` : '0'}
						</span>
					{/if}
				</li>
			{/each}
		</ul>
	</div>

	<!-- the map, and the standings after this round -->
	<div class="flex w-[33.75rem] shrink-0 flex-col gap-8">
		<div
			class="relative h-75 shrink-0 overflow-hidden rounded-3xl bg-ctp-surface0 outline-4 outline-ctp-lavender"
		>
			{#if image}
				<img
					in:fade
					src={image}
					alt=""
					class="absolute inset-0 size-full object-cover"
					draggable="false"
				/>
			{/if}
		</div>

		{#if standings.length}
			<div class="flex flex-col gap-3">
				<span class="text-2xl tracking-[0.16em] text-ctp-subtext0 uppercase">Standings</span>
				<ol class="flex flex-col gap-1">
					{#each standings as s (s.steamId3)}
						<li class="flex items-center gap-4 px-3 py-1.5">
							<span class="w-9">{@render Position(s.position, 'text-3xl')}</span>
							<span class="min-w-0 flex-1 truncate text-3xl text-white">
								{playerLabel(s.steamId3)}
							</span>
							<span
								class="text-3xl font-semibold text-ctp-lavender tabular-nums {settings.current
									.monoFont}"
								style:filter={getFiltersStyle()}
							>
								{formatScore(s.score)}
							</span>
						</li>
					{/each}
				</ol>
			</div>
		{/if}
	</div>
{/snippet}

<!-- MARK: D2: final standings -->
{#snippet FinalBoard()}
	<div class="flex min-w-0 flex-1 items-end justify-center gap-6">
		{#each podium as p (p.steamId3)}
			{@const first = p.rank === 1}
			{@const medal = medals[p.rank]}
			{@const player = getPlayer(p.steamId3)}
			<div class="flex min-w-0 flex-1 flex-col items-center">
				{#if settings.current.enableAvatars}
					<span
						class="mb-6 flex items-center justify-center overflow-hidden rounded-[1.75rem] bg-ctp-lavender/15 font-bold text-ctp-lavender uppercase ring-6 {medal.ring} {first
							? 'size-50 text-[6.25rem]'
							: 'size-39 text-[4.875rem]'}"
					>
						{#if player.avatarURL}
							<img
								in:fade
								src={player.avatarURL}
								alt=""
								class="size-full object-cover"
								draggable="false"
							/>
						{:else}
							{playerLabel(p.steamId3)[0]}
						{/if}
					</span>
				{/if}
				<span
					class="block w-full truncate text-center leading-[1.05] font-bold text-white uppercase"
					{@attach fitText(first ? 60 : 46, settings.current.font, playerLabel(p.steamId3))}
				>
					{playerLabel(p.steamId3)}
				</span>
				<span class="mt-1.5 flex items-baseline gap-2.5">
					<span
						class="text-[2.75rem] font-bold text-ctp-lavender tabular-nums {settings.current
							.monoFont}"
						style:filter={getFiltersStyle()}
					>
						{formatScore(p.score)}
					</span>
					<span class="text-2xl font-semibold text-ctp-subtext0 uppercase">
						{isRjr ? 'pts' : 'avg'}
					</span>
				</span>
				<div
					class="mt-5 flex w-full flex-col items-center gap-1 rounded-t-[1.25rem] border-t-8 pt-5 {medal.border} {medal.bg} {podiumBlock[
						p.rank
					]}"
				>
					<span
						class="leading-none font-bold {medal.text} {settings.current.monoFont} {first
							? 'text-[7.5rem]'
							: 'text-8xl'}"
					>
						{p.rank}
					</span>
					<span class="text-[1.375rem] font-bold tracking-[0.16em] text-white uppercase opacity-85">
						{podiumLabel[p.rank]}
					</span>
				</div>
			</div>
		{/each}
	</div>

	<!-- who won each round -->
	<div class="flex w-[35rem] shrink-0 flex-col justify-end gap-3">
		<span class="text-2xl tracking-[0.16em] text-ctp-subtext0 uppercase">Round winners</span>
		<ol class="flex flex-col gap-0.5">
			{#each played as r (r.roundIndex)}
				{@const winner = winnerOf(r)}
				<li class="flex items-baseline gap-4.5 px-4 py-1">
					<span
						class="w-10 shrink-0 text-2xl font-semibold text-ctp-lavender {settings.current
							.monoFont}"
						style:filter={getFiltersStyle()}
					>
						{roundNo(r)}
					</span>
					<span class="min-w-0 flex-1 truncate text-[1.625rem] text-ctp-subtext1">
						{roundMap(r)}
					</span>
					{#if winner !== undefined}
						<span class="shrink-0 text-[1.625rem] font-semibold text-white">
							{playerLabel(winner)}
						</span>
					{/if}
				</li>
			{/each}
		</ol>
	</div>
{/snippet}

<!-- MARK: shared -->
{#snippet Position(position: number, size: string)}
	<span class="font-bold {size} {medalText(position)} {settings.current.monoFont}">
		{position}
	</span>
{/snippet}

<!-- a player's avatar, or their initial when JTOO has none -->
{#snippet Avatar(steamId3: SteamID3, className: string)}
	{#if settings.current.enableAvatars}
		{@const player = getPlayer(steamId3)}
		{#if player.avatarURL}
			<img
				in:fade
				src={player.avatarURL}
				alt=""
				class="shrink-0 object-cover {className}"
				draggable="false"
			/>
		{:else}
			<span
				class="flex shrink-0 items-center justify-center bg-ctp-lavender/15 font-bold text-ctp-lavender uppercase {className}"
				style:filter={getFiltersStyle()}
			>
				{playerLabel(steamId3)[0]}
			</span>
		{/if}
	{/if}
{/snippet}
