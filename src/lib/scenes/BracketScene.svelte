<script lang="ts">
	import {
		clearWinner,
		formatOf,
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
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { items, settings, overlay } from '$lib/storage.svelte';
	import type { SteamID3 } from '$lib/types.svelte';
	import { getPlayer, playerLabel } from '$lib/util';
	import { fade, type TransitionConfig } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { onIdleScene } from '$lib/obs-browser-source.svelte';

	type Coordinate = { x: number; y: number };
	type Line = { A: Coordinate; B: Coordinate };

	const maxNameLength = 15;
	const curveRadius = 25;

	// reveals an element left to right. Unlike slide it only clips, so the element keeps
	// its size throughout and text doesn't re-wrap and shift the layout (and the lines) around
	function wipe(_node: Element, { duration = 400 } = {}): TransitionConfig {
		return {
			duration,
			easing: cubicOut,
			css: (t) => `clip-path: inset(0 ${(1 - t) * 100}% 0 0)`
		};
	}

	// the bracket picked in the controls
	let saved = $derived(items.current.brackets?.find((b) => b.id == overlay.current.bracket));
	let format = $derived(saved ? formatOf(saved) : undefined);

	// MARK: Layout
	// Each round is a column, upper bracket on the top row and lower bracket below. The lower
	// bracket is right-aligned, so both finals line up under the grand final.

	function gridColumn(format: Format, half: Half, i: number) {
		const offset = half == 'lower' ? format.upper.length - format.lower.length : 0;
		return offset + i + 1;
	}

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

	// MARK: Lines
	// Lines between matches are measured from the rendered page rather than placed by hand.
	// The scene only renders at 1920x1080 in OBS, so the positions on the page are reliable.

	let sectionEl: HTMLElement | undefined;
	// match boxes on the page, by match id
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

{#if saved && format}
	{#if onIdleScene()}
		<!-- the bracket has no backdrop of its own, so over the Idle scene's game footage it gets
		     the same darkening the other scenes' SceneTint gives them -->
		<div class="pointer-events-none fixed inset-0 bg-black/50"></div>
	{/if}
	<section class="relative isolate z-1 m-auto" {@attach watchSection}>
		<div class="grid gap-x-40 gap-y-20">
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

{#snippet RoundColumn(format: Format, round: Round, half: Half, i: number)}
	<div
		class="relative flex flex-col"
		style:grid-row={half == 'upper' ? 1 : 2}
		style:grid-column={gridColumn(format, half, i)}
		in:fade
	>
		<!-- a single elimination bracket has only the one half, so it needs no label -->
		{#if i == 0 && format.lower.length}
			<h2 class="half-label" style:filter={getFiltersStyle()}>
				{half == 'upper' ? 'Upper' : 'Lower'} Bracket
			</h2>
		{/if}
		<h2 class="text-3xl" style:filter={getFiltersStyle()}>{round.name}</h2>
		<div class="grid grow">
			<div class="stage-container">
				{#each rowsOf(format, half, i) as match, row (row)}
					{#if match}
						{@render Match(match)}
					{:else}
						<div class="invisible min-h-32 min-w-60"></div>
					{/if}
				{/each}
			</div>
			<div class="background" style:filter={getFiltersStyle()}></div>
		</div>
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
		d="M{A.x} {A.y} H{midX - r} a{r},{r} 0 0 {sweep} {r},{dir * r} V{B.y -
			dir * r} a{r},{r} 0 0 {1 - sweep} {r},{dir * r} H{B.x}"
	></path>
{/snippet}

{#snippet Match(match: MatchDef)}
	{@const [A, B] = playersOf(saved!, match.id)}
	{@const winner = winnerOf(saved!, match.id)}
	{@const won: Slot | '' = !winner ? '' : winner == A ? 'A' : 'B'}
	<div class="grid" {@attach watchMatch(match.id)}>
		<div
			class="col-[1/1] row-[1/1] flex min-h-32 min-w-60 flex-col justify-between rounded-xl text-3xl"
		>
			{@render MatchPlayer(match.id, A, 'A', won)}
			{@render MatchPlayer(match.id, B, 'B', won)}
		</div>
		<div
			class="col-[1/1] row-[1/1] min-h-32 min-w-60 rounded-xl bg-linear-to-tr
                        {A && B && !winner
				? 'from-ctp-lavender-950 via-ctp-lavender-800 to-ctp-lavender-400'
				: 'from-[#121925] via-[bg-gray-800] to-[#202833]'} bg-gray-800"
			style:filter={getFiltersStyle()}
		></div>
	</div>
{/snippet}

<!-- click to set the winner, right click to clear it -->
{#snippet MatchPlayer(id: string, steamID3: SteamID3 | undefined, player: Slot, won: Slot | '')}
	{@const avatarURL = steamID3 ? getPlayer(steamID3).avatarURL : ''}
	{#key won}
		<button
			in:wipe={{ duration: 800 }}
			class="z-1 grow"
			onclick={() => setWinner(saved!, id, player)}
			oncontextmenu={() => clearWinner(saved!, id)}
		>
			<div class="grid">
				<div class="col-[1/1] row-[1/1] flex h-full w-full items-center gap-4 p-2">
					{#if settings.current.enableAvatars && avatarURL}
						{#key avatarURL}
							<img
								in:fade
								src={avatarURL}
								alt=""
								class="size-12 rounded-xl object-cover object-center"
								draggable="false"
							/>
						{/key}
					{/if}
					<span style:filter={getFiltersStyle()}>
						{steamID3 ? playerLabel(steamID3, maxNameLength) : ''}
					</span>
				</div>
				<div
					class=" -z-1 col-[1/1] row-[1/1] h-full w-full bg-linear-to-tr pl-6
                                        {player == 'A' ? 'rounded-t-xl' : 'rounded-b-xl'}
                                        {won
						? won == player
							? 'from-[#40834a]   via-[#369455]  to-[#b2e1bd]'
							: 'from-ctp-lavender-950/60 via-ctp-lavender-900/20 to-ctp-lavender-950/10'
						: ''}"
					style:filter={getFiltersStyle()}
				></div>
			</div>
		</button>
	{/key}
{/snippet}

<style>
	@import 'tailwindcss';
	@import '@catppuccin/tailwindcss/mocha.css';
	h2 {
		@apply mb-2 text-center;
	}
	/* sits in the gap left of a half's first round, without taking up any room */
	.half-label {
		@apply absolute top-1/2 right-full mr-10 -translate-y-1/2 rotate-180 text-3xl whitespace-nowrap [writing-mode:vertical-lr];
	}
	.stage-container {
		@apply col-[1/1] row-[1/1] flex h-full flex-col justify-around gap-4 rounded-xl;
	}
	.stage-container ~ .background {
		@apply -z-1 col-[1/1] row-[1/1] min-h-32 min-w-60 rounded-xl bg-gray-900/70;
	}

	svg > path {
		@apply fill-none stroke-ctp-lavender-900 stroke-2;
	}
</style>
