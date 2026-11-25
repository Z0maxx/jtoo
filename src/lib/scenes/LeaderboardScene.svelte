<script lang="ts">
	import SceneTint from '$lib/components/SceneTint.svelte';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { settings } from '$lib/storage.svelte';
	import { fade } from 'svelte/transition';
	import { getContext } from 'svelte';
	import Flag from '$lib/components/util/Flag.svelte';
	import { getPlayer, msToFormattedTime, msToGap, playerLabel } from '$lib/util';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import type {
		PlayerStatus,
		RoundResultEntry,
		TournamentRound,
		TournamentStanding
	} from '$lib/websockets/console/live-types';

	let live: ConsoleLive = getContext('consoleLive');

	let tournament = $derived(live.tournament);
	let rounds = $derived(tournament?.rounds ?? []);
	// avatar, flag and name, as PlayerCells renders them
	let playerColumns = $derived(
		(settings.current.enableAvatars ? 1 : 0) + (settings.current.enableFlags ? 1 : 0) + 1
	);

	// -1 is the cumulative standings, otherwise an index into rounds
	let selected = $state(0);
	let selectedRound = $derived(
		selected < 0 ? undefined : (rounds[selected] ?? rounds[rounds.length - 1])
	);
	let results = $derived(selectedRound ? roundResults(selectedRound) : []);
	let leaderPrMs = $derived(results.find((r) => r.prMs !== null)?.prMs ?? null);

	const maxPlayers = 8;

	// A round only has results once it's finalized. Until then, show the live race if it's
	// this round's race.
	function roundResults(round: TournamentRound): RoundResultEntry[] {
		if (round.finalized) return round.results;

		const race = live.currentRace;
		if (!race || race.sessionId !== round.sessionId) return [];

		return race.leaderboard.map((e) => ({
			placement: e.position,
			steamId3: e.steamId3,
			status: e.status,
			prMs: e.prMs,
			bestProgress: e.bestProgress
		}));
	}

	function isOut(status: PlayerStatus) {
		return status === 'disqualified' || status === 'withdrawn';
	}

	function formatScore(score: number): string {
		if (tournament?.scoring === 'average-placement') return score.toFixed(2);
		return Number.isInteger(score) ? `${score}` : score.toFixed(2);
	}

	let scoreHeader = $derived(tournament?.scoring === 'rjr-points' ? 'Points' : 'Average Placement');

	function roundIsValid(round: TournamentRound) {
		return !round.voided && round.finalized;
	}
	// the total table only draws valid rounds, so its columns count only those
	let validRoundCount = $derived(rounds.filter(roundIsValid).length);
</script>

<!-- isolated border filter -->
<div class="border-b-4 border-ctp-lavender/50" style:filter={getFiltersStyle()}></div>

<section class="relative z-20 m-auto flex w-full flex-col justify-center gap-10 p-4">
	<SceneTint class="-z-10" />
	{#if !tournament}
		<div class="text-center text-3xl italic opacity-60">
			{live.tournamentId ? 'loading tournament...' : 'no tournament'}
		</div>
	{:else}
		<ul class="flex justify-center gap-10 text-xl">
			{#each rounds as round, i (round.roundIndex)}
				{#if roundIsValid(round)}
					<button onclick={() => (selected = i)}>
						<li
							class="{selectedRound === round
								? 'bg-ctp-lavender-950/40'
								: ''} rounded-xl p-2 pr-4 pl-4"
						>
							<div>
								{round.stage || `round ${i + 1}`}
							</div>
							<div class="italic opacity-80">
								{round.map}
							</div>
						</li>
					</button>
				{/if}
			{/each}
			<button onclick={() => (selected = -1)}>
				<li class="{selected == -1 ? 'bg-ctp-lavender-950/40' : ''} rounded-xl p-2 pr-4 pl-4">
					Total
				</li>
			</button>
		</ul>
		{#if selectedRound}
			<!-- position, the player's columns, gap and pr -->
			<ul
				class="grid items-center justify-center gap-x-6 gap-y-2 text-3xl"
				style:grid-template-columns="repeat({1 + playerColumns + 2}, max-content)"
			>
				<!--position-->
				<li></li>
				{#if settings.current.enableAvatars}
					<!--avatar-->
					<li></li>
				{/if}
				{#if settings.current.enableFlags}
					<!--flag-->
					<li></li>
				{/if}
				{@render Header('Player')}
				{@render Header(`Gap`)}
				{@render Header('PR')}

				<hr class="hr" />
				{#each results.slice(0, maxPlayers) as entry, i (entry.steamId3)}
					{@render Row(entry, i)}
					<hr class="hr" />
				{/each}
			</ul>
		{:else if selected == -1}
			<!-- position, the player's columns, a placement per round and the score -->
			<ul
				class="grid items-center justify-center gap-x-6 gap-y-2 text-3xl"
				style:grid-template-columns="repeat({1 + playerColumns + validRoundCount + 1}, max-content)"
			>
				<!--position-->
				<li></li>
				{#if settings.current.enableAvatars}
					<!--avatar-->
					<li></li>
				{/if}
				{#if settings.current.enableFlags}
					<!--flag-->
					<li></li>
				{/if}
				{@render Header('Player')}
				{#each rounds as round, i (round.roundIndex)}
					{#if roundIsValid(round)}
						<li class="text-center text-xl italic opacity-60" style:filter={getFiltersStyle()}>
							{round.stage}
						</li>
					{/if}
				{/each}
				{@render Header(scoreHeader)}

				<hr class="hr" />
				{#each tournament.standings.slice(0, maxPlayers) as standing (standing.steamId3)}
					{@render TotalRow(standing)}
					<hr class="hr" />
				{/each}
			</ul>
		{/if}
	{/if}
</section>

{#snippet Header(title: string)}
	<li class="pr-20 italic opacity-60" style:filter={getFiltersStyle()}>{title}</li>
{/snippet}

{#snippet PlayerCells(steamId3: number)}
	{@const player = getPlayer(steamId3)}
	{#if settings.current.enableAvatars}
		<!-- avatar -->
		<li>
			{#if player.avatarURL}
				<img
					in:fade
					src={player.avatarURL}
					alt=""
					class="size-16 rounded-xl object-cover object-center"
					draggable="false"
				/>
			{/if}
		</li>
	{/if}
	{#if settings.current.enableFlags}
		<!-- flag -->
		<li>
			{#if player.flag}
				<Flag code={player.flag} class="rounded-xl text-[6rem]" />
			{/if}
		</li>
	{/if}
	<!-- name -->
	<li>
		{playerLabel(steamId3)}
	</li>
{/snippet}

{#snippet Row(entry: RoundResultEntry, i: number)}
	{@const out = isOut(entry.status)}
	<!-- position -->
	<li class={settings.current.monoFont}>{out ? '-' : entry.placement}</li>
	{@render PlayerCells(entry.steamId3)}
	<!-- gap -->
	<li class={settings.current.monoFont}>
		{#if i > 0 && entry.prMs !== null && leaderPrMs !== null}
			{msToGap(entry.prMs - leaderPrMs)}
		{:else}
			--
		{/if}
	</li>
	<!-- pr -->
	<li class={settings.current.monoFont}>
		{#if !entry.prMs}
			DNF
		{:else if entry.prMs !== null}
			{msToFormattedTime(entry.prMs)}
		{/if}
	</li>
{/snippet}

{#snippet TotalRow(standing: TournamentStanding)}
	<!-- position -->
	<li class={settings.current.monoFont}>{standing.position}</li>
	{@render PlayerCells(standing.steamId3)}
	<!-- placement per round -->
	{#each rounds as round, i (round.roundIndex)}
		{#if roundIsValid(round)}
			<li class="text-center text-xl {settings.current.monoFont}">
				{standing.placements[i] ?? '-'}
			</li>
		{/if}
	{/each}
	<!-- score -->
	<li class={settings.current.monoFont}>
		{formatScore(standing.score)}
	</li>
{/snippet}
