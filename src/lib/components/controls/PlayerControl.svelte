<script lang="ts">
	import { overlay, items, settings } from '$lib/storage.svelte';
	import type { SteamID3 } from '$lib/types.svelte';
	import { poolPlayers } from '$lib/console-pools.svelte';
	import { getContext, untrack } from 'svelte';
	import PlayerList from './PlayerList.svelte';
	import type { ConsoleLive } from '$lib/websockets/console/console-live.svelte';
	import type { LeaderboardEntry } from '$lib/websockets/console/live-types';
	import { massSingleOrder, type JFRelayWebSocket } from '$lib/websockets/jf-relay/js-relay.svelte';

	let live: ConsoleLive = getContext('consoleLive');
	let jfRelayWs: JFRelayWebSocket = getContext('jfRelayWs');

	type Props = {
		playerNum: 0 | 1 | 2 | 3;
	};

	const slotLabel = { 0: 'A', 1: 'B', 2: 'C', 3: 'D' } as const;

	type Slot = keyof typeof slotLabel; // 1 | 2

	function getLabel(slot: Slot) {
		return slotLabel[slot];
	}

	let { playerNum }: Props = $props();

	// MARK: player list
	// the race's players, or the pool's players when there's no race or 'only list the race's
	// players' is off. How the race's players are ordered depends on its mode, see raceOrder.
	// the order only refreshes every 10 seconds, and not while the pointer is over the list,
	// so buttons don't move out from under a click
	const REFRESH_MS = 10_000;

	const byPosition = (board: LeaderboardEntry[]) =>
		[...board].sort((a, b) => a.position - b.position).map((e) => e.steamId3);

	function raceOrder(board: LeaderboardEntry[]): SteamID3[] {
		switch (live.currentRace?.mode) {
			// a duel's two players stay where they are
			case 'duel': {
				const onBoard = board.map((e) => e.steamId3);
				const kept = players.filter((id) => onBoard.includes(id));
				return [...kept, ...onBoard.filter((id) => !kept.includes(id))];
			}
			// finished, then running by map progress, then the rest; see massSingleOrder
			case 'mass-single':
				return massSingleOrder(board, jfRelayWs.progress);
			default:
				return byPosition(board);
		}
	}

	function listOrder(): SteamID3[] {
		const board = settings.current.followRacePlayers ? live.currentRace?.leaderboard : undefined;
		const list = board?.length ? raceOrder(board) : [...poolPlayers()];
		// keep the selected player visible even when they're not in the race
		const selected = overlay.current.players[playerNum];
		if (selected && !list.includes(selected)) list.push(selected);
		return list;
	}

	let players: SteamID3[] = $state([]);
	players = untrack(listOrder);
	let hovered = $state(false);
	let refreshMissed = false; // a refresh came due while hovered

	// the name filter applies straight away, on top of the race filtering above
	let nameFilter = $state('');
	// every items.current read parses all of items (maps' PRs included) from storage, so the
	// names are read once per change, not once per row, or rebuilding the lists takes seconds
	const names = $derived(new Map(items.current.players.map((p) => [p.steamID3, p.name] as const)));
	const playerLabel = (sId3: SteamID3) => names.get(sId3) || `[U:1:${sId3}]`;
	let shownPlayers = $derived.by(() => {
		const query = nameFilter.trim().toLowerCase();
		if (!query) return players;
		return players.filter((sId3) => playerLabel(sId3).toLowerCase().includes(query));
	});

	// MARK: race status
	// in a mass-single race the list runs finished players, then running ones by progress, so
	// marking who's finished (see PlayerList) shows where the running players start: the first
	// unmarked player is the one leading among those still running. read live, not from the
	// list's 10 second refresh, so a finish shows straight away
	const raceEntries = $derived(
		live.currentRace?.mode === 'mass-single'
			? new Map(live.currentRace.leaderboard.map((e) => [e.steamId3, e]))
			: new Map<SteamID3, LeaderboardEntry>()
	);
	// force: refresh even with the pointer over the list, for changes asked for on purpose.
	// exported, so the 'follow race' switch can refresh the list as it's pressed
	export function refresh(force = false) {
		if (hovered && !force) {
			refreshMissed = true;
			return;
		}
		refreshMissed = false;
		players = listOrder();
	}

	$effect(() => {
		const timer = setInterval(() => refresh(), REFRESH_MS);
		return () => clearInterval(timer);
	});

	// a new race (or the feed connecting) swaps the players, so that refreshes right away
	$effect(() => {
		void live.currentRace?.sessionId;
		untrack(() => refresh());
	});
	// toggling 'follow race' calls refresh(true) itself, see the controls page
</script>

<div class="flex w-full max-w-full flex-col items-start">
	{#if players}
		<span class="self-center pb-0.5 text-center label">player {getLabel(playerNum)}</span>

		<div class="flex w-full flex-col">
			<!-- name -->
			{#if items.current.players.length === 0}
				<span class="text-ctp-text/50">no players..</span>
			{:else}
				<input
					type="search"
					class="mb-2 input"
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
					<PlayerList
						players={shownPlayers}
						bind:value={overlay.current.players[playerNum]}
						label={playerLabel}
						entries={raceEntries}
						onreselect={() =>
							jfRelayWs.broadcastSelectedPlayers([
								overlay.current.players[0],
								overlay.current.players[1]
							])}
					/>
				</div>
			{/if}
		</div>
	{/if}
</div>
