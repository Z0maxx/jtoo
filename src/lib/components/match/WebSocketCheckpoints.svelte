<script lang="ts">
	import { settings } from '$lib/storage.svelte';
	import { getPlayer, msToFormattedTime } from '$lib/util';
	import { fade } from 'svelte/transition';
	import { getContext } from 'svelte';
	import type { SteamID3 } from '$lib/types.svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import type { DelayedPlayers } from '$lib/delayed-players.svelte';

	let live: ConsoleLive = getContext('consoleLive');
	// the selected players, switched as late as the in-game spectator switches
	let shown: DelayedPlayers = getContext('overlayPlayers');

	type Props = { numPlayers: number };
	let { numPlayers }: Props = $props();

	let numCps = $derived(live.currentRace?.checkpoints.length ?? 0);
	// the leader's PR splits, or their current splits if they haven't finished
	let leaderSplits = $derived(
		live.leader
			? live.leader.prMs !== null
				? live.leader.prSplitsMs
				: live.leader.currentSplitsMs
			: []
	);
</script>

<div class="absolute right-0 left-0 m-auto mt-2 w-[25%] {settings.current.monoFont}">
	{#if live.leader}
		<!-- header -->
		<div class="grid grid-cols-3 items-center justify-center gap-x-4 text-center text-3xl">
			<div class="justify-self-end">
				{#if settings.current.enableAvatars && getPlayer(live.leader.steamId3).avatarURL}
					<img
						in:fade
						src={getPlayer(live.leader.steamId3).avatarURL}
						alt=""
						class="size-13 rounded-xl object-cover object-center"
						draggable="false"
					/>
				{/if}
			</div>
			<div class="col-span-2 mt-2 h-11">
				<span>
					{live.leader.prMs !== null ? msToFormattedTime(live.leader.prMs) : '---'}
				</span>
			</div>
			<hr class="hr" />
		</div>

		<!-- cps -->
		<div
			class="grid h-83 grid-cols-3 justify-center gap-x-4
                        {numCps > 14 ? 'gap-y-1 text-2xl' : 'gap-y-3 text-3xl'}"
		>
			{@render Comparison(shown.players[0], 0)}

			<!-- leader cps -->
			<div class="justify-self-center text-center">
				{#each leaderSplits as split, i (i)}
					{#if split !== null}
						<div>{msToFormattedTime(split)}</div>
					{/if}
				{/each}
			</div>

			{@render Comparison(shown.players[1], 1)}
		</div>
	{/if}
</div>

{#snippet Comparison(steamID3: SteamID3 | undefined, playerNum: number)}
	{@const playerSplits = live.entryFor(steamID3)?.currentSplitsMs ?? []}
	<div class={playerNum == 0 ? 'justify-self-end text-right' : 'justify-self-start text-left'}>
		{#each leaderSplits as leaderSplit, i (i)}
			{#if leaderSplit !== null}
				{@const playerSplit = playerSplits[i] ?? null}
				<div>
					{#if playerSplit !== null}
						{@const diff = Math.trunc((playerSplit - leaderSplit) / 10) / 100}
						{@const speed: 'faster' | 'same' | 'slower' = diff < 0 ? 'faster' : diff > 0 ? 'slower' : 'same'}
						{@const clr = {
							faster: playerNum == 0 ? 'bg-ctp-blue-800/55' : 'bg-ctp-red-800/55',
							slower: playerNum == 0 ? 'bg-ctp-blue-950/40' : 'bg-ctp-red-950/40',
							same: 'bg-ctp-teal-950/55'
						}}

						<span
							transition:fade|global
							class="rounded-lg px-2.5 {clr[speed]} {numCps > 14 ? 'text-xl' : 'text-2xl'}"
						>
							{speed == 'same' ? '-' : speed == 'slower' ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
						</span>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
{/snippet}
