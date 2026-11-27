<script lang="ts">
	import SceneFrame from '$lib/components/scene/SceneFrame.svelte';
	import SceneHeader from '$lib/components/scene/SceneHeader.svelte';
	import SceneTag from '$lib/components/scene/SceneTag.svelte';
	import Flag from '$lib/components/util/Flag.svelte';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { settings } from '$lib/storage.svelte';
	import { poolPlayers } from '$lib/console-pools.svelte';
	import { getPlayer } from '$lib/util';
	import { fade } from 'svelte/transition';

	const EVENT_NAME = 'Jump4Charity';
	// 36px rows with 5px gaps fit 16 under the header at 1080p
	const MAX_PLAYERS = 16;
	// every bar starts at this share of the track, so the shortest still fits a name; the rest
	// of it is the player's points against the leader's
	const BAR_MIN_PERCENT = 20;
	// the bar never fills the track, leaving room for the points and title after it
	const BAR_MAX_PERCENT = 85;

	// gold, silver and bronze for the first three bars
	const medals = [
		{ text: 'text-ctp-yellow', bar: 'bg-ctp-yellow/50 ring-ctp-yellow' },
		{ text: 'text-ctp-subtext1', bar: 'bg-ctp-subtext1/45 ring-ctp-subtext1' },
		{ text: 'text-ctp-peach', bar: 'bg-ctp-peach/45 ring-ctp-peach' }
	];

	let tfClass = $derived(settings.current.tfClass ?? 'soldier');

	// ranks, points, WRs and TTs come from Tempus and Tempus Plaza, and aren't there for every
	// player. a rank of 0 is a player Tempus hasn't ranked in this class
	let players = $derived(
		poolPlayers()
			.map((id) => getPlayer(id))
			.filter((p) => p.name)
			.map((p) => {
				const rank = p.rank?.[tfClass];
				return {
					player: p,
					rank: rank?.rank || null,
					points: rank?.points ?? 0,
					title: rank?.title
				};
			})
			// best rank first, then the unranked by name
			.sort(
				(a, b) =>
					(a.rank ?? Infinity) - (b.rank ?? Infinity) || a.player.name.localeCompare(b.player.name)
			)
			.slice(0, MAX_PLAYERS)
	);
	let maxPoints = $derived(Math.max(1, ...players.map((p) => p.points)));

	function barWidth(rank: number | null, points: number): string {
		const share = rank === null ? 0 : points / maxPoints;
		const pct = BAR_MIN_PERCENT + (100 - BAR_MIN_PERCENT) * share;
		return `${(pct * BAR_MAX_PERCENT) / 100}%`;
	}
</script>

<SceneFrame class="gap-8">
	<SceneHeader eventName={EVENT_NAME} title="PLAYERS">
		{#snippet subtitle()}
			<span
				class="text-5xl leading-tight font-bold text-ctp-lavender uppercase"
				style:filter={getFiltersStyle()}
			>
				by {tfClass} rank
			</span>
		{/snippet}
		{#snippet aside()}
			<SceneTag class="px-6 text-3xl uppercase">{tfClass}</SceneTag>
		{/snippet}
	</SceneHeader>

	{#if players.length}
		<div class="flex min-h-0 flex-1 flex-col gap-2.5">
			<div
				class="grid grid-cols-[6rem_minmax(0,1fr)_6rem_6rem] items-center gap-x-5 text-xl tracking-[0.16em] text-ctp-subtext0 uppercase"
			>
				<span class="text-right">Rank</span>
				<span>Player</span>
				<span class="text-right">WRs</span>
				<span class="text-right">TTs</span>
			</div>
			<ol class="flex flex-col gap-2">
				{#each players as { player, rank, points, title }, i (i)}
					{@const medal = rank !== null ? medals[i] : undefined}
					{@const mono = settings.current.monoFont}
					<li class="grid h-9 grid-cols-[6rem_minmax(0,1fr)_6rem_6rem] items-center gap-x-5">
						<span
							class="text-right text-[1.75rem] font-bold {mono} 
                                                        {rank === null
								? 'text-ctp-overlay0'
								: (medal?.text ?? 'text-ctp-lavender')}"
							style:filter={medal ? undefined : getFiltersStyle()}
						>
							{rank === null ? '–' : `#${rank}`}
						</span>

						<!-- the bar, then the points and title after it -->
						<span class="flex h-full min-w-0 items-center gap-3.5">
							<span
								class="relative isolate flex h-full items-center gap-3 overflow-hidden pr-3.5 pl-2 transition-[width] duration-700"
								style:width={barWidth(rank, points)}
							>
								<!-- the fill on its own layer, so the theme filter doesn't tint the avatar -->
								<span
									class="absolute inset-0 -z-10 rounded-[0.625rem] {medal
										? `ring-2 ring-inset ${medal.bar}`
										: rank === null
											? 'bg-ctp-overlay0/25'
											: 'bg-ctp-lavender/30'}"
									style:filter={medal || rank === null ? undefined : getFiltersStyle()}
								></span>
								{#if settings.current.enableFlags}
									<div class="w-7">
										{#if player.flag}
											<Flag code={player.flag} class="shrink-0 rounded-sm text-2xl" />
										{/if}
									</div>
								{/if}
								{#if settings.current.enableAvatars}
									{#if player.avatarURL}
										<img
											in:fade
											src={player.avatarURL}
											alt=""
											class="size-7.5 shrink-0 rounded-lg object-cover"
											draggable="false"
										/>
									{:else}
										<span
											class="flex size-7.5 shrink-0 items-center justify-center rounded-lg bg-ctp-crust/55 text-base font-bold text-white uppercase"
										>
											{player.name[0]}
										</span>
									{/if}
								{/if}

								<span class="truncate text-2xl font-semibold text-white">{player.name}</span>
								<span class="shrink-0 truncate text-lg text-ctp-subtext0">
									{rank === null ? 'unranked' : (title ?? '')}
								</span>
							</span>
							<span
								class="shrink-0 text-2xl font-semibold text-ctp-lavender tabular-nums {mono}"
								style:filter={getFiltersStyle()}
							>
								{rank === null ? '–' : points.toLocaleString('en-US')}
							</span>
						</span>

						<span class="text-right text-2xl font-semibold text-white tabular-nums {mono}">
							{player.WRs?.[tfClass] ?? '–'}
						</span>
						<span class="text-right text-2xl font-semibold text-ctp-subtext1 tabular-nums {mono}">
							{player.TTs?.[tfClass] ?? '–'}
						</span>
					</li>
				{/each}
			</ol>
		</div>
	{:else}
		<p class="text-3xl text-ctp-subtext0 italic">no players</p>
	{/if}
</SceneFrame>
