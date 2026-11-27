<script lang="ts">
	import SceneFrame from '$lib/components/scene/SceneFrame.svelte';
	import SceneHeader from '$lib/components/scene/SceneHeader.svelte';
	import SceneTag from '$lib/components/scene/SceneTag.svelte';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { overlay, settings } from '$lib/storage.svelte';
	import { fade } from 'svelte/transition';
	import { getContext } from 'svelte';
	import { fitText } from '$lib/fit-text';
	import type { Attachment } from 'svelte/attachments';
	import {
		getMap,
		getPlayer,
		msToFormattedTime,
		msToGap,
		playerLabel,
		roundNumber
	} from '$lib/util';
	import { mapName } from '$lib/map-picks';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import type {
		RoundResultEntry,
		SteamID3,
		TournamentRound
	} from '$lib/websockets/console/live-types';

	const EVENT_NAME = 'Jump4Charity';
	const MAX_ROWS = 20;
	// past this many rows the tables tighten their padding, so the text can stay bigger
	const COMPACT_ROWS = 10;
	// the tables are sized in em off their font size (px), which steps down from the max until
	// every row fits
	const TABLE_SIZE = { max: 16, min: 8 };
	// the rounds list is sized to fit this many rounds (the RJR qualifier's 7), and only shrinks
	// below that size when there are more
	const ROUNDS_TO_FIT = 7;
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
	// a duel tournament's rounds are separate matches, so it only shows each round's results:
	// no standings, round numbers or scoring
	let isDuel = $derived(tournament?.kind === 'duel');
	let rounds = $derived(tournament?.rounds ?? []);
	// rounds that count toward the standings; voided ones were played but don't
	const counts = (round: TournamentRound) => round.finalized && !round.voided;
	let played = $derived(rounds.filter(counts));

	// the board picked in the controls: a round that isn't in this tournament shows the standings,
	// or in a duel tournament, which has none, the latest round
	let view = $derived(overlay.current.leaderboardView ?? 'standings');
	let round = $derived(
		(typeof view === 'number' ? played.find((r) => r.roundIndex === view) : undefined) ??
			(isDuel ? played.at(-1) : undefined)
	);
	let board: 'standings' | 'round' | 'final' = $derived(
		round ? 'round' : view === 'final' ? 'final' : 'standings'
	);

	// numbered without the voided rounds
	const roundNo = (round: TournamentRound) => roundNumber(rounds, round);
	// as the settings want maps shown. the console doesn't record a duel round's map (duel races
	// don't say which map they're on), so those fall back to the round's name
	const roundMap = (round: TournamentRound) => (round.map ? mapName(round.map) : round.stage);
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

	// steps the element's font size down from TABLE_SIZE.max until its content fits its height.
	// with minRows, the size is instead the one that fits that many rows (or all of them, when
	// there are more), so fewer rows keep that size rather than growing. its rows are its
	// children, all the same height. anything else passed is only there to refit when it
	// changes, eg: the rows or the font
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- only read by svelte, to refit
	function fitRows(minRows: number, ..._refitOn: unknown[]): Attachment<HTMLElement> {
		return (el) => {
			const fit = () => {
				let size = TABLE_SIZE.max;
				el.style.fontSize = `${size}px`;
				const row = el.firstElementChild as HTMLElement | null;
				if (minRows && row && el.clientHeight) {
					// rows and gaps scale with the font size, so measure them once and scale to fit
					const rows = Math.max(minRows, el.children.length);
					const gap = parseFloat(getComputedStyle(el).rowGap) || 0;
					const needed = rows * row.offsetHeight + (rows - 1) * gap;
					size = Math.max(TABLE_SIZE.min, Math.floor(((size * el.clientHeight) / needed) * 2) / 2);
					el.style.fontSize = `${size}px`;
				}
				// borders and outlines don't scale, so step down any overflow they leave
				while (el.scrollHeight > el.clientHeight && size > TABLE_SIZE.min) {
					size -= 0.5;
					el.style.fontSize = `${size}px`;
				}
			};
			fit();
			// its height comes from the scene, not its content, so refitting can't loop
			const resize = new ResizeObserver(fit);
			resize.observe(el);
			return () => resize.disconnect();
		};
	}

	// MARK: header
	let title = $derived(
		board === 'round' && round
			? isDuel
				? 'Round Results'
				: `Round ${roundNo(round)} Results`
			: board === 'final'
				? 'Final Standings'
				: 'Leaderboard'
	);
	let subtitleText = $derived.by(() => {
		if (!tournament) return '';
		// a round with no map recorded (see roundMap) shows no subtitle
		if (board === 'round' && round) return round.map ? mapName(round.map) : '';
		return `${tournament.name}`;
	});
	let scoringLabel = $derived(isRjr ? 'RJR' : 'Avg Placement');

	// MARK: standings (A)
	// the placement columns are the counted rounds; placements line up with tournament.rounds
	let playedColumns = $derived(played.map((r) => rounds.indexOf(r)));
	let standingsRows = $derived(tournament?.standings.slice(0, MAX_ROWS) ?? []);
	let standingsCompact = $derived(standingsRows.length > COMPACT_ROWS);
	// every column but the name is only as wide as its widest value, so names get the rest
	let standingsColumns = $derived(
		[
			'3em',
			avatarColumn(standingsCompact),
			'minmax(0, 1fr)',
			`repeat(${played.length}, 3.25em)`,
			isRjr ? '6em' : '8.5em'
		]
			.filter(Boolean)
			.join(' ')
	);

	function avatarColumn(compact: boolean) {
		if (!settings.current.enableAvatars) return '';
		return compact ? '2.75em' : '3.5em';
	}

	// MARK: round results (B)
	let resultRows = $derived(round?.results.slice(0, MAX_ROWS) ?? []);
	let resultsCompact = $derived(resultRows.length > COMPACT_ROWS);
	// the name takes what's left, so the wider time and gap columns narrow it here only
	// the points column is the scoring method's, so a duel tournament doesn't show it
	let showPoints = $derived(isRjr && !isDuel);
	let resultColumns = $derived(
		[
			'3em',
			avatarColumn(resultsCompact),
			'minmax(0, 1fr)',
			'15em',
			'11em',
			showPoints ? '5.5em' : ''
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
			{#if tournament && !isDuel}
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
	{:else if isDuel && !round}
		<p class="text-3xl text-ctp-subtext0 italic">no rounds played yet</p>
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
	{@const compact = standingsCompact}
	<div
		class="flex min-h-0 min-w-0 flex-1 flex-col gap-[0.75em] overflow-hidden"
		{@attach fitRows(0, standingsRows, standingsColumns, settings.current.font)}
	>
		<div
			class="grid items-center gap-x-[1em] px-[1.5em] text-ctp-subtext0 uppercase *:text-[1.375em] *:tracking-[0.16em]"
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
		<ul class="flex flex-col {compact ? 'gap-[0.125em]' : 'gap-[0.375em]'}">
			{#each standingsRows as s (s.steamId3)}
				<li
					class="grid items-center gap-x-[1em] rounded-[1em] px-[1.5em] leading-tight
                                        {compact ? 'py-[0.2em]' : 'py-[0.625em]'}"
					style:grid-template-columns={standingsColumns}
				>
					{@render Position(s.position, 'text-[2.5em]')}
					{@render Avatar(s.steamId3, compact)}
					<span class="truncate text-[2.375em] text-white">{playerLabel(s.steamId3)}</span>
					{#each playedColumns as column (column)}
						{@const p = s.placements[column]}
						<span class="flex justify-center">
							<span
								class="inline-flex min-w-[1.85em] items-center justify-center rounded-[0.385em] px-[0.15em] text-[1.625em] leading-none font-semibold {compact
									? 'h-[1.4em]'
									: 'h-[1.7em]'} {settings.current.monoFont} {p === 1
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
						class="text-right text-[2.5em] font-semibold text-ctp-lavender tabular-nums {settings
							.current.monoFont}"
						style:filter={getFiltersStyle()}
					>
						{formatScore(s.score)}
					</span>
				</li>
			{/each}
		</ul>
	</div>

	{@render RoundsList()}
{/snippet}

<!-- the rounds played so far and who won them, as tiles styled like the map scene's cards -->
{#snippet RoundsList()}
	<div class="flex w-[28rem] shrink-0 flex-col gap-4">
		<span class="text-2xl tracking-[0.16em] text-ctp-subtext0 uppercase">Rounds</span>
		<!-- sized in em, shrinking from full size until every round fits -->
		<ul
			class="flex min-h-0 flex-1 flex-col gap-[0.75em] overflow-hidden"
			{@attach fitRows(
				ROUNDS_TO_FIT,
				played,
				settings.current.font,
				settings.current.enableAvatars
			)}
		>
			{#each played as r (r.roundIndex)}
				{@const winner = winnerOf(r)}
				{@const image = getMap(r.map).imageURL}
				{@const avatar = winner !== undefined ? getPlayer(winner).avatarURL : ''}
				<!-- the outline is drawn inside, so the list's overflow doesn't clip it -->
				<li
					class="relative isolate flex shrink-0 items-center gap-[1em] overflow-hidden rounded-[1em] px-[1em] py-[0.75em] outline-2 -outline-offset-2 outline-ctp-lavender/25"
				>
					{#if image}
						<img
							in:fade
							src={image}
							alt=""
							class="absolute inset-0 -z-10 size-full object-cover"
							draggable="false"
						/>
					{/if}
					<!-- dark under the text, fading out so the map shows on the right -->
					<div
						class="absolute inset-0 -z-10 bg-linear-to-r from-ctp-crust/90 via-ctp-crust/60 to-ctp-crust/10"
					></div>
					<!-- widths and gaps in each span's own em, so they follow its text size -->
					<span
						class="w-[1.5em] shrink-0 text-center text-[1.875em] font-bold text-ctp-lavender
                                                {settings.current.monoFont}"
						style:filter={getFiltersStyle()}
					>
						{roundNo(r)}
					</span>
					<span class="flex min-w-0 flex-1 flex-col items-start gap-[0.375em]">
						<span class="w-full truncate text-[1.5em] leading-tight font-bold text-white uppercase">
							{roundMap(r)}
						</span>
						<!-- the winner, in the map cards' pick badge -->
						{#if winner !== undefined}
							<span
								class="flex max-w-full items-center gap-[0.5em] rounded-[0.6em] bg-ctp-crust/85 py-[0.2em] pr-[0.7em] pl-[0.6em] text-[1.6em]"
							>
								<span class="icon-[mdi--crown] shrink-0 text-ctp-yellow" aria-hidden="true"></span>
								{#if settings.current.enableAvatars && avatar}
									<img
										src={avatar}
										alt=""
										class="size-[1.6em] shrink-0 rounded-[0.4em] object-cover"
										draggable="false"
									/>
								{/if}
								<span class="truncate font-semibold text-white">{playerLabel(winner)}</span>
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
	{@const standings = isDuel ? [] : standingsThrough(round).slice(0, TOP_STANDINGS)}
	{@const compact = resultsCompact}
	<div
		class="flex min-h-0 min-w-0 flex-1 flex-col gap-[0.75em] overflow-hidden"
		{@attach fitRows(0, resultRows, resultColumns, settings.current.font)}
	>
		<div
			class="grid items-center gap-x-[1.25em] px-[1.5em] text-ctp-subtext0 uppercase *:text-[1.375em] *:tracking-[0.16em]"
			style:grid-template-columns={resultColumns}
		>
			<span></span>
			{#if settings.current.enableAvatars}<span></span>{/if}
			<span>Player</span>
			<span class="text-right">Time</span>
			<span class="text-right">Gap</span>
			{#if showPoints}<span class="text-right">Pts</span>{/if}
		</div>
		<ul class="flex flex-col {compact ? 'gap-[0.125em]' : 'gap-[0.375em]'}">
			{#each resultRows as entry, i (entry.steamId3)}
				{@const mono = settings.current.monoFont}
				<li
					class="relative isolate grid items-center gap-x-[1.25em] rounded-[1em] px-[1.5em] leading-tight {compact
						? 'py-[0.2em]'
						: 'py-[0.625em]'}"
					style:grid-template-columns={resultColumns}
				>
					{#if i === 0}
						<!-- absolute, so it takes no grid cell -->
						<div
							class="absolute inset-0 -z-10 rounded-[1em] bg-ctp-lavender/15 ring-2 ring-ctp-lavender/45 ring-inset"
							style:filter={getFiltersStyle()}
						></div>
					{/if}
					{@render Position(entry.placement, 'text-[2.5em]')}
					{@render Avatar(entry.steamId3, compact)}
					<span class="truncate text-[2.375em] text-white" class:font-bold={i === 0}>
						{playerLabel(entry.steamId3)}
					</span>
					<span
						class="text-right text-[2.375em] font-semibold tabular-nums {mono} {entry.prMs === null
							? 'text-ctp-overlay0'
							: 'text-white'}"
					>
						{entry.prMs === null ? 'DNF' : msToFormattedTime(entry.prMs)}
					</span>
					<span class="text-right text-[1.875em] font-medium text-ctp-subtext0 tabular-nums {mono}">
						{gap(entry, i)}
					</span>
					{#if showPoints}
						<span
							class="text-right text-[2.125em] font-bold text-ctp-lavender tabular-nums {mono}"
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
	<div class="flex w-[28rem] shrink-0 flex-col gap-8">
		<!-- a round with no map recorded (see roundMap) has nothing to show here -->
		{#if round.map}
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
				<!-- the map's name along the bottom, on a fade dark enough to read over any map -->
				<div
					class="absolute inset-x-0 bottom-0 bg-linear-to-t from-ctp-crust/90 via-ctp-crust/60 to-transparent px-5 pt-12 pb-3"
				>
					<span class="block truncate text-4xl leading-tight font-bold text-white uppercase">
						{mapName(round.map)}
					</span>
				</div>
			</div>
		{/if}

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
				</div>
			</div>
		{/each}
	</div>

	{@render RoundsList()}
{/snippet}

<!-- MARK: shared -->
{#snippet Position(position: number, size: string)}
	<span class="font-bold {size} {medalText(position)} {settings.current.monoFont}">
		{position}
	</span>
{/snippet}

<!-- a table row's avatar, or the player's initial when JTOO has none -->
{#snippet Avatar(steamId3: SteamID3, compact: boolean)}
	{#if settings.current.enableAvatars}
		{@const player = getPlayer(steamId3)}
		<!-- 2em of its own text: the avatar column's 2.75em or 3.5em of the table's -->
		{@const className = `size-[2em] rounded-[0.43em] ${compact ? 'text-[1.375em]' : 'text-[1.75em]'}`}
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
