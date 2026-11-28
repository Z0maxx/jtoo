<script lang="ts">
	import {
		bestOfOf,
		FORMAT_BEST_OF,
		clearWinner,
		formatOf,
		gameWins,
		playersOf,
		setWinner,
		winnerOf,
		type Format,
		type Half,
		type MatchDef,
		type Round,
		type Slot
	} from '$lib/Bracket.svelte';
	import type { Attachment } from 'svelte/attachments';
	import { getContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { items, settings, overlay } from '$lib/storage.svelte';
	import type { SteamID3 } from '$lib/types.svelte';
	import { getPlayer, playerLabel } from '$lib/util';
	import { liveMatch, toggleLive } from '$lib/bracket-live.svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import SceneFrame from '$lib/components/scene/SceneFrame.svelte';
	import PicksStarted from '$lib/components/scene/PicksStarted.svelte';
	import SceneHeader from '$lib/components/scene/SceneHeader.svelte';
	import SceneTag from '$lib/components/scene/SceneTag.svelte';

	type Coordinate = { x: number; y: number };
	type Line = { A: Coordinate; B: Coordinate };

	const EVENT_NAME = 'Jump4Charity';
	const curveRadius = 25;

	let live: ConsoleLive = getContext('consoleLive');

	// the bracket picked in the controls
	let saved = $derived(items.current.brackets?.find((b) => b.id == overlay.current.bracket));
	let format = $derived(saved ? formatOf(saved) : undefined);
	// the match whose duel race is underway on the console
	let liveId = $derived(saved ? liveMatch(saved, live.currentRace) : undefined);

	// MARK: Layout
	// Each round is a column, the upper bracket's rounds over the lower bracket's. The shorter
	// half is right-aligned, so both finals line up under the grand final. A double elimination
	// bracket labels each half in a column of its own on the left.

	let hasLower = $derived(!!format?.lower.length);
	let columns = $derived(format ? Math.max(format.upper.length, format.lower.length) : 0);

	function gridColumn(format: Format, half: Half, i: number) {
		const offset = columns - format[half].length;
		return offset + i + (hasLower ? 2 : 1);
	}

	// each half's matches get height in proportion to its most crowded round
	let gridRows = $derived.by(() => {
		if (!format) return '';
		const rows = (half: Half) =>
			Math.max(1, ...format![half].map((_, i) => rowsOf(format!, half, i).length));
		return hasLower ? `auto ${rows('upper')}fr auto ${rows('lower')}fr` : `auto ${rows('upper')}fr`;
	});

	// a round feeding a bigger one (a play-in) gets a row per match of that round,
	// so each match sits level with the match it feeds. Rows it doesn't feed are left empty.
	function rowsOf(format: Format, half: Half, i: number): (MatchDef | undefined)[] {
		const round = format[half][i];
		const next = format[half][i + 1];
		if (!next || next.matches.length <= round.matches.length) return round.matches;
		return next.matches.map((n) => round.matches.find((m) => feeds(m, n)));
	}

	function feeds(from: MatchDef, to: MatchDef) {
		return [to.A, to.B].some((s) => 'winnerOf' in s && s.winnerOf == from.id);
	}

	// a single elimination bracket has only the one half, so its matches get more room
	const sizes = {
		double: {
			row: 'h-11',
			match: 'h-22',
			seed: 'text-xl',
			crown: 'text-2xl',
			avatar: 'size-9',
			name: 'text-[1.75rem]'
		},
		single: {
			row: 'h-14',
			match: 'h-28',
			seed: 'text-xl',
			crown: 'text-3xl',
			avatar: 'size-11',
			name: 'text-[2rem]'
		}
	};
	let size = $derived(hasLower ? sizes.double : sizes.single);

	// middle click picks the live match, or unpicks it
	function onMiddleClick(e: MouseEvent, id: string) {
		if (e.button !== 1 || !saved) return;
		e.preventDefault();
		toggleLive(saved, id, live.currentRace);
	}

	const seedOf = (steamID3: SteamID3) => (saved?.players.indexOf(steamID3) ?? -1) + 1;

	// MARK: Lines
	// Lines between matches are measured from the rendered page rather than placed by hand.
	// The scene only renders at 1920x1080 in OBS, so the positions on the page are reliable.

	let sectionEl: HTMLElement | undefined;
	// match boxes on the page, by match id
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read by measure, not rendered
	const matchEls = new Map<string, HTMLElement>();
	let lines: Line[] = $state([]);

	// re-measures whenever the section or any match changes size
	let resizeObserver: ResizeObserver | undefined;
	function observe(node: HTMLElement) {
		resizeObserver ??= new ResizeObserver(measure);
		resizeObserver.observe(node);
		return () => resizeObserver?.unobserve(node);
	}

	const watchSection: Attachment<HTMLElement> = (node) => {
		sectionEl = node;
		const unobserve = observe(node);
		return () => {
			unobserve();
			if (sectionEl == node) sectionEl = undefined;
		};
	};

	function watchMatch(id: string): Attachment<HTMLElement> {
		return (node) => {
			matchEls.set(id, node);
			const unobserve = observe(node);
			return () => {
				unobserve();
				if (matchEls.get(id) == node) matchEls.delete(id);
			};
		};
	}

	// each match joins the match its winner moves to, when that is in the same half of the bracket
	function getLinks(format: Format): [string, string][] {
		const links: [string, string][] = [];
		for (const to of Object.values(format.matches)) {
			for (const source of [to.A, to.B]) {
				if ('winnerOf' in source && format.matches[source.winnerOf].half == to.half) {
					links.push([source.winnerOf, to.id]);
				}
			}
		}
		return links;
	}

	// a line runs from the middle of a match's right edge to the middle of the next match's left edge
	function measure() {
		if (!sectionEl || !format) {
			lines = [];
			return;
		}
		const origin = sectionEl.getBoundingClientRect();
		const middle = (r: DOMRect) => r.top + r.height / 2 - origin.top;
		lines = getLinks(format).flatMap(([from, to]) => {
			const a = matchEls.get(from)?.getBoundingClientRect();
			const b = matchEls.get(to)?.getBoundingClientRect();
			if (!a || !b) return [];
			return [
				{
					A: { x: a.right - origin.left, y: middle(a) },
					B: { x: b.left - origin.left, y: middle(b) }
				}
			];
		});
	}
</script>

<SceneFrame class="gap-10">
	<SceneHeader eventName={EVENT_NAME} title="Bracket">
		{#snippet subtitle()}
			{#if saved?.name}
				<span
					class="truncate text-5xl leading-tight font-bold text-ctp-lavender uppercase"
					style:filter={getFiltersStyle()}
				>
					{saved.name}
				</span>
			{/if}
		{/snippet}
		{#snippet aside()}
			{#if saved}
				<div in:fade>
					<SceneTag class="px-6 text-3xl uppercase">
						{saved.elimination ?? 'double'} Elim · Bo{FORMAT_BEST_OF}
					</SceneTag>
				</div>
			{/if}
		{/snippet}
	</SceneHeader>

	{#if !saved || !format}
		<p class="text-3xl text-ctp-subtext0 italic" style:filter={getFiltersStyle()}>
			no bracket selected
		</p>
	{:else}
		<section class="relative isolate flex min-h-0 flex-1" {@attach watchSection}>
			<div
				class="grid w-full gap-x-20 gap-y-3"
				style:grid-template-columns="{hasLower ? 'auto ' : ''}repeat({columns}, minmax(0, 1fr))"
				style:grid-template-rows={gridRows}
			>
				{#if hasLower}
					{@render HalfLabel('upper')}
					{@render HalfLabel('lower')}
				{/if}
				{#each format.upper as round, i (round.name)}
					{@render RoundColumn(format, round, 'upper', i)}
				{/each}
				{#each format.lower as round, i (round.name)}
					{@render RoundColumn(format, round, 'lower', i)}
				{/each}
			</div>
			{@render Lines()}
		</section>
	{/if}
	<PicksStarted />
</SceneFrame>

<!-- reads bottom to top, beside its half's matches -->
{#snippet HalfLabel(half: Half)}
	<h2
		class="rotate-180 self-center text-[1.375rem] font-bold tracking-[0.16em] whitespace-nowrap text-ctp-lavender uppercase [writing-mode:vertical-rl]"
		style:grid-column={1}
		style:grid-row={half == 'upper' ? 2 : 4}
		style:filter={getFiltersStyle()}
	>
		{half == 'upper' ? 'Upper' : 'Lower'} Bracket
	</h2>
{/snippet}

{#snippet RoundColumn(format: Format, round: Round, half: Half, i: number)}
	{@const column = gridColumn(format, half, i)}
	<h3
		class="text-center text-xl tracking-[0.16em] whitespace-nowrap text-ctp-subtext0 uppercase
                {half == 'lower' ? 'mt-4' : ''}"
		style:grid-column={column}
		style:grid-row={half == 'upper' ? 1 : 3}
		in:fade
		style:filter={getFiltersStyle()}
	>
		{round.name}
	</h3>
	<div
		class="flex min-w-0 flex-col justify-around gap-3"
		style:grid-column={column}
		style:grid-row={half == 'upper' ? 2 : 4}
		in:fade
	>
		{#each rowsOf(format, half, i) as match, row (row)}
			{#if match}
				{@render Match(match)}
			{:else}
				<div class="invisible {size.match}"></div>
			{/if}
		{/each}
	</div>
{/snippet}

{#snippet Lines()}
	<svg class="pointer-events-none absolute inset-0 -z-1 size-full" style:filter={getFiltersStyle()}>
		{#each lines as line, i (i)}
			{@render Path(line)}
		{/each}
	</svg>
{/snippet}

<!-- across to halfway, curve up or down to the next match's height, then across to it -->
{#snippet Path({ A, B }: Line)}
	{@const midX = (A.x + B.x) / 2}
	{@const dir = Math.sign(B.y - A.y)}
	<!-- level matches get a radius of 0, which draws a straight line -->
	{@const r = Math.min(curveRadius, Math.abs(B.y - A.y) / 2, (B.x - A.x) / 2)}
	{@const sweep = dir > 0 ? 1 : 0}
	<path
		class="fill-none stroke-ctp-lavender/40 stroke-3"
		d="M{A.x} {A.y} H{midX - r} a{r},{r} 0 0 {sweep} {r},{dir * r} V{B.y -
			dir * r} a{r},{r} 0 0 {1 - sweep} {r},{dir * r} H{B.x}"
	></path>
{/snippet}

<!-- MARK: Match -->
<!-- styled like a pair of the leaderboard's rows -->
{#snippet Match(match: MatchDef)}
	{@const [A, B] = playersOf(saved!, match.id)}
	{@const winner = winnerOf(saved!, match.id)}
	{@const won: Slot | '' = !winner ? '' : winner == A ? 'A' : 'B'}
	{@const isLive = liveId === match.id}
	{@const wins = gameWins(saved!, match.id)}
	<!-- a best of 1's score is just its winner, so it only shows for longer matches, once
         they've started. A winner picked by hand, with no games played, shows no score -->
	{@const showScore = bestOfOf(saved!, match.id) > 1 && (isLive || wins.A + wins.B > 0)}
	<!-- the usual best of is in the header, so only matches played over another are tagged,
         eg: the grand final -->
	{@const ownBestOf = bestOfOf(saved!, match.id) != FORMAT_BEST_OF ? bestOfOf(saved!, match.id) : 0}
	<div class="relative" {@attach watchMatch(match.id)}>
		<div class="flex flex-col overflow-hidden rounded-2xl bg-ctp-crust/70">
			{@render MatchPlayer(match.id, A, 'A', won, showScore ? wins.A : undefined)}
			{@render MatchPlayer(match.id, B, 'B', won, showScore ? wins.B : undefined)}
		</div>
		<!-- the outline is its own layer, so the filters tint it without tinting the avatars -->
		<div
			class="pointer-events-none absolute inset-0 rounded-2xl outline-2 -outline-offset-2 transition-colors
                        {isLive ? 'outline-ctp-lavender' : 'outline-ctp-lavender/25'}"
			style:filter={getFiltersStyle()}
		></div>
		{#if ownBestOf}
			<span
				transition:fade
				class="absolute -top-3 left-4 rounded-md border-2 border-ctp-lavender bg-ctp-crust px-2 text-[0.9375rem] font-bold tracking-[0.14em] text-ctp-lavender"
				style:filter={getFiltersStyle()}
			>
				BO{ownBestOf}
			</span>
		{/if}
		{#if isLive}
			<span
				transition:fade
				class="absolute -top-3 right-4 rounded-md bg-ctp-lavender px-2.5 py-0.5 text-[0.9375rem] font-bold tracking-[0.14em] text-ctp-crust"
				style:filter={getFiltersStyle()}
			>
				LIVE
			</span>
		{/if}
	</div>
{/snippet}

<!-- click to set the winner, right click to start the match over (no winner or games), middle
     click to make the match live -->
{#snippet MatchPlayer(
	id: string,
	steamID3: SteamID3 | undefined,
	player: Slot,
	won: Slot | '',
	score: number | undefined
)}
	{@const isWinner = won == player}
	{@const isLoser = !!won && !isWinner}
	{@const avatarURL = steamID3 ? getPlayer(steamID3).avatarURL : ''}
	<button
		class="relative isolate flex {size.row} w-full min-w-0 items-center gap-3.5 px-4 text-left"
		onclick={() => setWinner(saved!, id, player)}
		oncontextmenu={() => clearWinner(saved!, id)}
		onmousedown={(e) => e.button === 1 && e.preventDefault()}
		onauxclick={(e) => onMiddleClick(e, id)}
	>
		{#if isWinner}
			<div
				in:fade={{ duration: 300 }}
				class="absolute inset-0 -z-10 bg-ctp-lavender/30"
				style:filter={getFiltersStyle()}
			></div>
		{/if}
		{#if steamID3}
			<span
				class="w-6 shrink-0 text-center {size.seed} font-bold {settings.current.monoFont}
                                {isWinner
					? 'text-ctp-lavender'
					: isLoser
						? 'text-ctp-overlay0'
						: 'text-ctp-subtext0'}"
				style:filter={getFiltersStyle()}
			>
				{seedOf(steamID3)}
			</span>
			{#if settings.current.enableAvatars}
				{#if avatarURL}
					<img
						src={avatarURL}
						alt=""
						class="{size.avatar} shrink-0 rounded-lg object-cover transition {isLoser
							? 'opacity-35 grayscale'
							: ''}"
						draggable="false"
					/>
				{:else}
					<span
						class="flex {size.avatar} shrink-0 items-center justify-center rounded-lg bg-ctp-lavender/15 text-lg font-bold text-ctp-lavender uppercase transition {isLoser
							? 'opacity-35 grayscale'
							: ''}"
						style:filter={isLoser ? undefined : getFiltersStyle()}
					>
						{playerLabel(steamID3).charAt(0)}
					</span>
				{/if}
			{/if}
			<span
				class="min-w-0 flex-1 truncate {size.name} transition-colors
                                {isLoser ? 'text-ctp-overlay0' : 'text-white'} {isWinner
					? 'font-bold'
					: ''}"
				style:filter={getFiltersStyle()}
			>
				{playerLabel(steamID3)}
			</span>
			<!-- {#if isWinner}
				<span
					in:fade={{ duration: 300 }}
					class="icon-[mdi--crown] shrink-0 {size.crown} text-ctp-yellow"
					aria-hidden="true"
				></span>
			{/if} -->
			{#if score !== undefined}
				<span
					in:fade={{ duration: 300 }}
					class="shrink-0 text-center {size.seed} font-bold {settings.current.monoFont}
                                {isWinner
						? 'text-ctp-lavender'
						: isLoser
							? 'text-ctp-overlay0'
							: 'text-white'}"
					style:filter={getFiltersStyle()}
				>
					{score}
				</span>
			{/if}
		{:else}
			<!-- waiting on an earlier match -->
			<span class="w-6 shrink-0"></span>
			{#if settings.current.enableAvatars}
				<span
					class="{size.avatar} shrink-0 rounded-lg bg-ctp-overlay0/20"
					style:filter={getFiltersStyle()}
				></span>
			{/if}
			<span
				class="min-w-0 flex-1 truncate {size.name} text-ctp-overlay0 italic"
				style:filter={getFiltersStyle()}>TBD</span
			>
		{/if}
	</button>
{/snippet}
