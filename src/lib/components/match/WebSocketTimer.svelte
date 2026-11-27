<script lang="ts">
	import { overlay, settings } from '$lib/storage.svelte';
	import { type SteamID3 } from '$lib/types.svelte';
	import { countdownMs, msToFormattedTime, runDisplayMs } from '$lib/util';
	import { getContext } from 'svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import type { DelayedPlayers } from '$lib/delayed-players.svelte';

	let live: ConsoleLive = getContext('consoleLive');
	// the selected players, switched as late as the in-game spectator switches
	let shown: DelayedPlayers = getContext('overlayPlayers');

	type Props = { numPlayers: number; class?: string };
	let { numPlayers, class: styleClass }: Props = $props();

	// 'clear timers' in the controls hides runs and race windows that started before it, so
	// the board reads 0 between rounds until the next race starts
	let clearedAt = $derived(overlay.current.timersClearedAt ?? 0);
	let raceWindow = $derived.by(() => {
		const window = live.currentRace?.window;
		if (!window || (window.startsAt ?? 0) < clearedAt) return undefined;
		return window;
	});
	let timeLeftMs = $derived(
		raceWindow?.state === 'racing' ? countdownMs(raceWindow, live.serverNow()) : null
	);
	let overtime = $derived(raceWindow?.state === 'overtime');

	// a single run race's players all start together and get one run each, so their timers always
	// match: it shows one shared timer instead of each player's. It runs while anyone is running,
	// then holds the longest run. A duel with no time limit is a single run duel
	let singleRun = $derived.by(() => {
		const race = live.currentRace;
		return race?.mode === 'mass-single' || (race?.mode === 'duel' && race.window.endsAt === null);
	});
	let sharedRun = $derived.by(() => {
		const runs = (live.currentRace?.leaderboard ?? []).filter(
			(e) => e.runStartedAt !== null && e.runStartedAt >= clearedAt
		);
		const running = runs.filter((e) => e.status === 'running');
		return { running: running.length > 0, entries: running.length ? running : runs };
	});
</script>

{#if numPlayers == 2}
	<div
		class="{styleClass} grid h-20 grid-cols-3 items-center justify-center
                {settings.current.monoFont}"
	>
		{#if singleRun}
			<div></div>
			{@render SharedStopwatch()}
			<div></div>
		{:else}
			{@render PlayerStopwatch(shown.players[0])}
			{@render CompetitionTimer()}
			{@render PlayerStopwatch(shown.players[1])}
		{/if}
	</div>
{:else if numPlayers == 1}
	<div
		class="{styleClass} flex h-20 items-center justify-between *:w-fit
                {settings.current.monoFont}"
	>
		{#if singleRun}
			<div></div>
			{@render SharedStopwatch()}
		{:else}
			{@render PlayerStopwatch(shown.players[0])}
			{@render CompetitionTimer()}
		{/if}
	</div>
{/if}

{#snippet SharedStopwatch()}
	{@const now = sharedRun.running ? live.serverNow() : 0}
	{@const ms = Math.max(0, ...sharedRun.entries.map((e) => runDisplayMs(e, now)))}
	<!-- no label, centred on the 128px top bar: the box is centred on it in the single layout, but
	     sits 20px lower in the dual layout to leave room for the other timers' labels -->
	<div
		class="text-palewhite text-center text-5xl transition-colors duration-1000
        {numPlayers == 2 ? '-translate-y-5' : ''} {sharedRun.running ? '' : 'opacity-40'}"
	>
		{msToFormattedTime(ms)}
	</div>
{/snippet}

{#snippet PlayerStopwatch(player: SteamID3 | undefined)}
	{@const found = live.entryFor(player)}
	{@const entry =
		found && found.runStartedAt !== null && found.runStartedAt >= clearedAt ? found : undefined}
	<div class="text-palewhite flex h-fit flex-col justify-start text-center">
		{#if player}
			<div class="text-xl opacity-80 {settings.current.font}">run timer</div>
			<div
				class="{settings.current.monoFont} text-4xl transition-colors duration-1000
                                {entry?.status !== 'running' ? 'opacity-40' : ''}"
			>
				{msToFormattedTime(
					entry?.status === 'running'
						? runDisplayMs(entry, live.serverNow())
						: runDisplayMs(entry, 0)
				)}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet CompetitionTimer()}
	<div class="text-palewhite/40 flex h-full flex-col justify-start text-center">
		{#if (timeLeftMs !== null && timeLeftMs > 0) || overtime}
			<div class="text-xl opacity-80 {settings.current.font}">match timer</div>

			{#if timeLeftMs !== null && timeLeftMs > 0}
				<div class="text-5xl">
					<!-- round up, so the countdown shows 00:01 until it reaches 0 -->
					{msToFormattedTime(Math.ceil(timeLeftMs / 1000) * 1000, 'seconds')}
				</div>
			{/if}
			{#if overtime}
				<div class="text-4xl">OVERTIME</div>
			{/if}
		{/if}
	</div>
{/snippet}
