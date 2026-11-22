<script lang="ts">
	import { overlay, items, settings } from '$lib/storage.svelte';
	import { Player, type SteamID3 } from '$lib/types.svelte';
	import { getPlayer, getPlayerIndex } from '$lib/util';
	import { poolPlayers } from '$lib/console-pools.svelte';
	import { getContext, untrack } from 'svelte';
	import RadioInputs from './RadioInputs.svelte';
	import type { JFRelayWebSocket } from '$lib/websockets/jf-relay/js-relay.svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';

	let jfRelayWs: JFRelayWebSocket = getContext('jfRelayWs');
	let live: ConsoleLive = getContext('consoleLive');

	type Props = {
		player: SteamID3 | undefined;
		playerNum: 0 | 1 | 2 | 3;
	};

	const slotLabel = { 0: 'A', 1: 'B', 2: 'C', 3: 'D' } as const;

	type Slot = keyof typeof slotLabel; // 1 | 2

	function getLabel(slot: Slot) {
		return slotLabel[slot];
	}

	let { player, playerNum }: Props = $props();

	// MARK: player list
	// the race's players in leaderboard order, or the pool's players when there's no race or
	// 'only list the race's players' is off.
	// the order only refreshes every 10 seconds, and not while the pointer is over the list,
	// so buttons don't move out from under a click
	const REFRESH_MS = 10_000;

	function listOrder(): SteamID3[] {
		const board = settings.current.followRacePlayers ? live.currentRace?.leaderboard : undefined;
		const list = board?.length
			? [...board].sort((a, b) => a.position - b.position).map((e) => e.steamId3)
			: [...poolPlayers()];
		// keep the selected player visible even when they're not in the race
		const selected = overlay.current.players[playerNum];
		if (selected && !list.includes(selected)) list.push(selected);
		return list;
	}

	let players: SteamID3[] = $state(untrack(listOrder));
	let hovered = $state(false);
	let refreshMissed = false; // a refresh came due while hovered

	// the name filter applies straight away, on top of the race filtering above
	let nameFilter = $state('');
	const playerLabel = (sId3: SteamID3) => getPlayer(sId3).name || `[U:1:${sId3}]`;
	let shownPlayers = $derived.by(() => {
		const query = nameFilter.trim().toLowerCase();
		if (!query) return players;
		return players.filter((sId3) => playerLabel(sId3).toLowerCase().includes(query));
	});

	function refresh() {
		if (hovered) {
			refreshMissed = true;
			return;
		}
		refreshMissed = false;
		players = listOrder();
	}

	$effect(() => {
		const timer = setInterval(refresh, REFRESH_MS);
		return () => clearInterval(timer);
	});

	// a new race (or the feed connecting) swaps the players, and so does toggling the
	// setting, so those refresh right away
	$effect(() => {
		void live.currentRace?.sessionId;
		void settings.current.followRacePlayers;
		untrack(refresh);
	});
	// const playerObj: Player = $derived(getPlayer(player));
	// const maxScore: number = $derived((overlay.current.bestOf + 1) / 2);

	// function incrementScore(player: SteamID3) {
	// 	let newScore = playerObj.score;
	// 	newScore++;
	// 	if (newScore > maxScore) return;
	// 	items.current.players[getPlayerIndex(player)].score = newScore;
	// }
	// function decrementScore(player: SteamID3) {
	// 	let newScore = playerObj.score;
	// 	newScore--;
	// 	if (newScore < 0) return;
	// 	items.current.players[getPlayerIndex(player)].score = newScore;
	// }
</script>

<div class="flex w-full max-w-full flex-col items-start">
	{#if players}
		<span class="self-center text-center">player {getLabel(playerNum)}</span>

		<!-- score -->
		<!-- svelte-ignore a11y_consider_explicit_label -->
		<div class="flex justify-center self-center">
			<!-- <button
				class="button rounded-r-none"
				onclick={() => {
					if (player) decrementScore(player);
				}}><span class="icon-[mdi--minus] align-middle"></span></button
			>
			<span class="button button-selected rounded-none">{playerObj.score}</span> -->
			<!-- svelte-ignore a11y_consider_explicit_label -->
			<!-- <button
				class="button rounded-l-none border-ctp-lavender-950/50 bg-ctp-lavender/50 px-2 hover:bg-ctp-lavender/85"
				onclick={() => {
					if (player) incrementScore(player);
				}}><span class="icon-[mdi--plus] align-middle"></span></button
			> -->
		</div>

		<div class="flex flex-col">
			<!-- name -->
			<span>player</span>
			{#if items.current.players.length === 0}
				<span class="text-ctp-text/50">no players..</span>
			{:else}
				<input
					type="search"
					class="input mb-2"
					placeholder="filter by name"
					aria-label="filter player {getLabel(playerNum)} by name"
					bind:value={nameFilter}
					onkeydown={(e) => {
						if (e.key === 'Escape') nameFilter = '';
					}}
				/>
				<div
					role="group"
					onmouseenter={() => (hovered = true)}
					onmouseleave={() => {
						hovered = false;
						if (refreshMissed) refresh();
					}}
				>
					<RadioInputs
						optlabels={shownPlayers.map(playerLabel)}
						opts={shownPlayers}
						bind:value={overlay.current.players[playerNum]}
						onchange={() => {
							jfRelayWs.broadcastSelectedPlayers(overlay.current.players);
						}}
						undefinedOption={true}
					/>
				</div>
			{/if}
		</div>
	{/if}
</div>
