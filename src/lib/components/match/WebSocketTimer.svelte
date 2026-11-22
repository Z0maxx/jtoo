<script lang="ts">
	import { overlay, settings } from '$lib/storage.svelte';
	import { type SteamID3 } from '$lib/types.svelte';
	import { countdownMs, msToFormattedTime, runDisplayMs } from '$lib/util';
	import { getContext } from 'svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';

	let live: ConsoleLive = getContext('consoleLive');

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
</script>

{#if numPlayers == 2}
	<div
		class="{styleClass} grid h-20 grid-cols-3 items-center justify-center
                {settings.current.monoFont}"
	>
		{@render PlayerStopwatch(overlay.current.players[0])}
		{@render CompetitionTimer()}
		{@render PlayerStopwatch(overlay.current.players[1])}
	</div>
{:else if numPlayers == 1}
	<div
		class="{styleClass} flex h-20 items-center justify-between *:w-fit
                {settings.current.monoFont}"
	>
		{@render PlayerStopwatch(overlay.current.players[0])}
		{@render CompetitionTimer()}
	</div>
{/if}

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
