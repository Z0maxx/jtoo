<script lang="ts">
	import {
		clearMatchWinner,
		setMatchWinner,
		type AnyBracket,
		type Bracket8,
		type Match
	} from '$lib/Bracket.svelte';
	import type { Attachment } from 'svelte/attachments';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { items, settings, overlay } from '$lib/storage.svelte';
	import { getPlayer, playerLabel } from '$lib/util';
	import { fade, type TransitionConfig } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	type Coordinate = { x: number; y: number };
	type Line = { A: Coordinate; B: Coordinate };

	const maxNameLength = 15;

	// reveals an element left to right. Unlike slide it only clips, so the element keeps
	// its size throughout and text doesn't re-wrap and shift the layout (and the lines) around
	function wipe(_node: Element, { duration = 400 } = {}): TransitionConfig {
		return {
			duration,
			easing: cubicOut,
			css: (t) => `clip-path: inset(0 ${(1 - t) * 100}% 0 0)`
		};
	}
	const curveRadius = 25;

	// the bracket picked in the controls
	let saved = $derived(
		items.current.brackets?.find((b) => b.id == overlay.current.bracket) ?? { bracket: undefined }
	);

	// MARK: Lines
	// Lines between matches are measured from the rendered page rather than placed by hand.
	// The scene only renders at 1920x1080 in OBS, so the positions on the page are reliable.

	let sectionEl: HTMLElement | undefined;
	// match boxes on the page, by their path in the bracket, e.g. "Upper.QuarterFinals.0"
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
	function getLinks(bracket: AnyBracket): [string, string][] {
		const links: [string, string][] = [];
		for (const half of ['Upper', 'Lower'] as const) {
			const rounds = bracket[half] as Record<string, Match[]>;
			for (const [round, matches] of Object.entries(rounds)) {
				matches.forEach((match, i) => {
					if (match.winDest?.[0] == half) {
						links.push([`${half}.${round}.${i}`, match.winDest.slice(0, 3).join('.')]);
					}
				});
			}
		}
		return links;
	}

	// a line runs from the middle of a match's right edge to the middle of the next match's left edge
	function measure() {
		if (!sectionEl || !saved.bracket) {
			lines = [];
			return;
		}
		const origin = sectionEl.getBoundingClientRect();
		const middle = (r: DOMRect) => r.top + r.height / 2 - origin.top;
		lines = getLinks(saved.bracket).flatMap(([from, to]) => {
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

{#if saved.bracket}
	{#if saved.bracket.type == 8}
		<!-- MARK: 8 Player Bracket -->
		<section class="relative isolate z-1 m-auto" {@attach watchSection}>
			<div class=" flex flex-col gap-20">
				<div class="flex gap-40" in:fade>
					<h2
						class="-ml-40 max-w-0 translate-x-30 translate-y-10 rotate-180 text-3xl [writing-mode:vertical-lr]"
						style:filter={getFiltersStyle()}
					>
						Upper Bracket
					</h2>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Quarter Finals</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.QuarterFinals as match, i (i)}
									{@render Match(match, `Upper.QuarterFinals.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Semi Finals</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.SemiFinals as match, i (i)}
									{@render Match(match, `Upper.SemiFinals.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Final</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.Final as match, i (i)}
									{@render Match(match, `Upper.Final.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Grand Final</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.GrandFinal as match, i (i)}
									{@render Match(match, `Upper.GrandFinal.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
				</div>
				{@render Lower8(saved.bracket.Lower)}
			</div>
			{@render Lines()}
		</section>
	{:else if saved.bracket.type == 10}
		<!-- MARK: 10 Player Bracket -->
		<!-- the 8 player bracket, with a play-in column in front of the upper quarter-finals -->
		<section class="relative isolate z-1 m-auto" {@attach watchSection}>
			<div class=" flex flex-col gap-20">
				<div class="flex gap-40" in:fade>
					<h2
						class="-ml-40 max-w-0 translate-x-30 translate-y-10 rotate-180 text-3xl [writing-mode:vertical-lr]"
						style:filter={getFiltersStyle()}
					>
						Upper Bracket
					</h2>
					<!-- one row per quarter-final, so each play-in sits level with the match it feeds -->
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Play-In</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.QuarterFinals as _, q (q)}
									{@const i = saved.bracket.Upper.PlayIn.findIndex((m) => m.winDest?.[2] == q)}
									{#if i == -1}
										<div class="invisible min-h-32 min-w-60"></div>
									{:else}
										{@render Match(saved.bracket.Upper.PlayIn[i], `Upper.PlayIn.${i}`)}
									{/if}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Quarter Finals</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.QuarterFinals as match, i (i)}
									{@render Match(match, `Upper.QuarterFinals.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Semi Finals</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.SemiFinals as match, i (i)}
									{@render Match(match, `Upper.SemiFinals.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Final</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.Final as match, i (i)}
									{@render Match(match, `Upper.Final.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Grand Final</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.GrandFinal as match, i (i)}
									{@render Match(match, `Upper.GrandFinal.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
				</div>
				<!-- start the lower bracket under the quarter-finals (one column + gap = 400px) -->
				{@render Lower8(saved.bracket.Lower, 'ml-100')}
			</div>
			{@render Lines()}
		</section>
	{:else if saved.bracket.type == 4}
		<!-- MARK: 4 Player Bracket -->
		<section class="relative isolate z-1 m-auto" {@attach watchSection}>
			<div class=" flex flex-col gap-20">
				<div class="flex gap-40" in:fade>
					<h2
						class="-ml-40 max-w-0 translate-x-30 translate-y-10 rotate-180 text-3xl [writing-mode:vertical-lr]"
						style:filter={getFiltersStyle()}
					>
						Upper Bracket
					</h2>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Quarter Finals</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.QuarterFinals as match, i (i)}
									{@render Match(match, `Upper.QuarterFinals.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Semi Final</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.SemiFinal as match, i (i)}
									{@render Match(match, `Upper.SemiFinal.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Grand Final</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Upper.GrandFinal as match, i (i)}
									{@render Match(match, `Upper.GrandFinal.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
				</div>
				<div class="flex gap-40" in:fade>
					<h2
						class="-ml-40 max-w-0 translate-x-30 translate-y-10 rotate-180 text-3xl [writing-mode:vertical-lr]"
						style:filter={getFiltersStyle()}
					>
						Lower Bracket
					</h2>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Semi Final</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Lower.SemiFinal as match, i (i)}
									{@render Match(match, `Lower.SemiFinal.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
					<div class="flex flex-col">
						<h2 class="text-3xl" style:filter={getFiltersStyle()}>Final</h2>
						<div class="grid grow">
							<div class="stage-container">
								{#each saved.bracket.Lower.Final as match, i (i)}
									{@render Match(match, `Lower.Final.${i}`)}
								{/each}
							</div>
							<div class="background" style:filter={getFiltersStyle()}></div>
						</div>
					</div>
				</div>
			</div>
			{@render Lines()}
		</section>
	{/if}
{/if}

{#snippet Lower8(lower: Bracket8['Lower'], styleClass = '')}
	<div class="flex gap-40 {styleClass}" in:fade>
		<h2
			class="-ml-40 max-w-0 translate-x-30 translate-y-10 rotate-180 text-3xl [writing-mode:vertical-lr]"
			style:filter={getFiltersStyle()}
		>
			Lower Bracket
		</h2>
		<div class="flex flex-col">
			<h2 class="text-3xl" style:filter={getFiltersStyle()}>Round 1</h2>
			<div class="grid grow">
				<div class="stage-container">
					{#each lower.Round1 as match, i (i)}
						{@render Match(match, `Lower.Round1.${i}`)}
					{/each}
				</div>
				<div class="background" style:filter={getFiltersStyle()}></div>
			</div>
		</div>
		<div class="flex flex-col">
			<h2 class="text-3xl" style:filter={getFiltersStyle()}>Quarter Finals</h2>
			<div class="grid grow">
				<div class="stage-container">
					{#each lower.QuarterFinals as match, i (i)}
						{@render Match(match, `Lower.QuarterFinals.${i}`)}
					{/each}
				</div>
				<div class="background" style:filter={getFiltersStyle()}></div>
			</div>
		</div>
		<div class="flex flex-col">
			<h2 class="text-3xl" style:filter={getFiltersStyle()}>Semi Final</h2>
			<div class="grid grow">
				<div class="stage-container">
					{#each lower.SemiFinal as match, i (i)}
						{@render Match(match, `Lower.SemiFinal.${i}`)}
					{/each}
				</div>
				<div class="background" style:filter={getFiltersStyle()}></div>
			</div>
		</div>
		<div class="flex flex-col">
			<h2 class="text-3xl" style:filter={getFiltersStyle()}>Final</h2>
			<div class="grid grow">
				<div class="stage-container">
					{#each lower.Final as match, i (i)}
						{@render Match(match, `Lower.Final.${i}`)}
					{/each}
				</div>
				<div class="background" style:filter={getFiltersStyle()}></div>
			</div>
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

{#snippet Match(match: Match, id: string)}
	<div class="grid" {@attach watchMatch(id)}>
		<div
			class="col-[1/1] row-[1/1] flex min-h-32 min-w-60 flex-col justify-between rounded-xl text-3xl"
		>
			{@render MatchPlayer(match, 'A')}
			{@render MatchPlayer(match, 'B')}
		</div>
		<div
			class="col-[1/1] row-[1/1] min-h-32 min-w-60 rounded-xl bg-linear-to-tr
                        {match.A && match.B && !match.winner
				? 'from-ctp-lavender-950 via-ctp-lavender-800 to-ctp-lavender-400'
				: 'from-[#121925] via-[bg-gray-800] to-[#202833]'} bg-gray-800"
			style:filter={getFiltersStyle()}
		></div>
	</div>
{/snippet}

{#snippet MatchPlayer(match: Match, player: 'A' | 'B')}
	{@const steamID3 = match[player]}
	{@const avatarURL = steamID3 ? getPlayer(steamID3).avatarURL : ''}
	{#key match.winner}
		<button
			in:wipe={{ duration: 800 }}
			class="z-1 grow"
			onclick={() => {
				console.log(match);
				setMatchWinner(saved.bracket!, match, player);
				console.log(match);
			}}
			oncontextmenu={() => {
				clearMatchWinner(saved.bracket!, match);
			}}
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
				{console.log(match.winner)}
				<div
					class=" -z-1 col-[1/1] row-[1/1] h-full w-full bg-linear-to-tr pl-6
                                        {player == 'A' ? 'rounded-t-xl' : 'rounded-b-xl'}
                                        {match.winner
						? match.winner == player
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
	.stage-container {
		@apply col-[1/1] row-[1/1] flex h-full flex-col justify-around gap-4 rounded-xl;
	}
	.stage-container ~ .background {
		@apply -z-1 col-[1/1] row-[1/1] min-h-32 min-w-60 rounded-xl bg-gray-900/70;
	}

	svg > line {
		@apply stroke-ctp-lavender-900 stroke-2;
	}
	svg > path {
		@apply fill-none stroke-ctp-lavender-900 stroke-2;
	}
</style>
