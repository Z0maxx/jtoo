import { untrack } from 'svelte';
import { items, overlay, settings } from '$lib/storage.svelte';
import { Steam } from '$lib/api/steam/api-steam';
import { Tempus2 } from '$lib/api/tempus2/api-tempus2';
import type { MapFileName, SteamID3 } from '$lib/types.svelte';
import type { ConsoleLive } from './console-live.svelte';
import type { RaceSnapshot } from './live-types';
import type { PickSession } from '$lib/map-picks';

// Steam's GetPlayerSummaries takes at most 100 ids per call
const STEAM_BATCH = 100;

/**
 * Keeps JTOO's own data in step with the console's race: players on the board and the
 * map being played are fetched from Steam and Tempus when JTOO doesn't know them yet, for
 * anyone or anything outside the imported console pools. The stage and map labels follow the console too,
 * unless that's turned off in the controls, and a duel race selects its two racers as player A
 * and B. The picks and bans' round name is added as a stage and selected as well.
 *
 * Call it once during component initialisation, on the one page that should do this work
 * (the overlay), so other pages don't repeat the requests.
 */
export function syncWithRace(live: ConsoleLive, pickSession: () => PickSession | null | undefined) {
	// ids already asked for, so a failed or slow lookup isn't repeated every snapshot
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
	const requestedPlayers = new Set<SteamID3>();
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
	const requestedMaps = new Set<MapFileName>();
	// the console's stage and map last applied to the labels. A label is only set when the
	// console's value changes, so picking another one in the controls overrides it until then.
	let applied: { stage: string | null; map: string } | undefined;
	// the duel race whose players were last selected, so they're only selected once per race and
	// picking someone else in the controls sticks
	let selectedFor: number | undefined;

	$effect(() => {
		// dummy data never changes JTOO's own state
		const race = live.currentRace;
		if (!race || live.dummy) return;

		untrack(() => {
			syncPlayers(race, requestedPlayers);
			syncMap(race, requestedMaps);
			applied = syncLabels(race, applied);
			selectedFor = syncDuelPlayers(race, pickSession(), selectedFor);
		});
	});

	// the round name set on the console's picks and bans becomes a stage and is selected. Like the
	// race's stage it's only selected when it changes, so picking another stage in the controls sticks
	let appliedRound: string | null | undefined;
	$effect(() => {
		const roundName = pickSession()?.roundName || null;
		if (live.dummy) return;

		untrack(() => {
			if (roundName === appliedRound) return;
			appliedRound = roundName;
			// undefined on settings saved before this option existed, which means on
			if (roundName && settings.current.followConsoleStageMap !== false) selectStage(roundName);
		});
	});
}

// adds the stage to the controls' list when it isn't there yet, and shows it
function selectStage(stage: string) {
	if (!items.current.stages.includes(stage)) {
		items.current.stages = [...items.current.stages, stage];
	}
	overlay.current.stage = stage;
}

function syncPlayers(race: RaceSnapshot, requested: Set<SteamID3>) {
	const onBoard = race.leaderboard.map((e) => e.steamId3);

	// fetch anyone JTOO has no player for
	const known = new Set(items.current.players.map((p) => p.steamID3));
	const unknown = onBoard.filter((id) => !known.has(id) && !requested.has(id));
	if (unknown.length === 0) return;

	for (const id of unknown) requested.add(id);
	for (let i = 0; i < unknown.length; i += STEAM_BATCH) {
		fetchPlayers(unknown.slice(i, i + STEAM_BATCH));
	}
}

async function fetchPlayers(steamId3s: SteamID3[]) {
	try {
		const summaries = await Steam.fetchPlayerSummaries(steamId3s.map((id) => `[U:1:${id}]`));
		if (!summaries) return;

		const known = new Set(items.current.players.map((p) => p.steamID3));
		const added = summaries
			.map((ps) => Steam.playerSummaryToPlayer(ps))
			.filter((p) => p.steamID3 && !known.has(p.steamID3));
		if (added.length > 0) items.current.players = [...items.current.players, ...added];
	} catch (e) {
		console.error('race sync: could not fetch players', e);
	}
}

function syncMap(race: RaceSnapshot, requested: Set<MapFileName>) {
	const map = race.context.map;
	if (!map) return;

	// fetch it from Tempus if JTOO doesn't have it
	if (requested.has(map) || items.current.maps.some((m) => m.fileName == map)) return;
	requested.add(map);
	fetchMap(map);
}

function syncLabels(
	race: RaceSnapshot,
	applied: { stage: string | null; map: string } | undefined
) {
	const { stage, map } = race.context;
	// undefined on settings saved before this option existed, which means on
	if (settings.current.followConsoleStageMap === false) return { stage, map };

	if (stage && stage !== applied?.stage) selectStage(stage);
	if (map && map !== applied?.map) {
		overlay.current.map = map;
	}

	return { stage, map };
}

function syncDuelPlayers(
	race: RaceSnapshot,
	session: PickSession | null | undefined,
	selectedFor: number | undefined
) {
	if (race.mode !== 'duel' || race.sessionId === selectedFor) return selectedFor;
	// undefined on settings saved before this option existed, which means on
	if (settings.current.selectDuelPlayers === false) return race.sessionId;

	// wait for both racers to be on the board
	const racers = [...race.leaderboard]
		.sort((a, b) => a.position - b.position)
		.map((e) => e.steamId3);
	if (racers.length < 2) return selectedFor;

	// the pick & ban session's A and B when it's these two, so they keep their sides and colours;
	// the board's order otherwise
	let [a, b] = racers;
	if (session) {
		const sessionA = Steam.convertSteamId(session.playerA.steamId3, 'SteamID3') as SteamID3;
		const sessionB = Steam.convertSteamId(session.playerB.steamId3, 'SteamID3') as SteamID3;
		if (racers.includes(sessionA) && racers.includes(sessionB)) [a, b] = [sessionA, sessionB];
	}

	overlay.current.players[0] = a;
	overlay.current.players[1] = b;
	return race.sessionId;
}

async function fetchMap(fileName: MapFileName) {
	try {
		const map = await Tempus2.fetchMapByName(fileName);
		if (!map || items.current.maps.some((m) => m.fileName == map.fileName)) return;
		items.current.maps = [...items.current.maps, map];
	} catch (e) {
		console.error('race sync: could not fetch map', e);
	}
}
