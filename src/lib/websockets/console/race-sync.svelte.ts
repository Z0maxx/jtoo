import { untrack } from 'svelte';
import { items, overlay, settings } from '$lib/storage.svelte';
import { Steam } from '$lib/api/steam/api-steam';
import { Tempus2 } from '$lib/api/tempus2/api-tempus2';
import type { MapFileName, SteamID3, Tournament } from '$lib/types.svelte';
import type { ConsoleLive } from './console-live.svelte';
import type { RaceSnapshot } from './live-types';

// Steam's GetPlayerSummaries takes at most 100 ids per call
const STEAM_BATCH = 100;

/**
 * Keeps JTOO's own data in step with the console's race: players on the board and the
 * map being played are added to the selected JTOO tournament, and fetched from Steam and
 * Tempus when JTOO doesn't know them yet. The stage and map labels follow the console too,
 * unless that's turned off in the controls.
 *
 * Call it once during component initialisation, on the one page that should do this work
 * (the overlay), so other pages don't repeat the requests.
 */
export function syncWithRace(live: ConsoleLive) {
	// ids already asked for, so a failed or slow lookup isn't repeated every snapshot
	const requestedPlayers = new Set<SteamID3>();
	const requestedMaps = new Set<MapFileName>();
	// the console's stage and map last applied to the labels. A label is only set when the
	// console's value changes, so picking another one in the controls overrides it until then.
	let applied: { stage: string | null; map: string } | undefined;

	$effect(() => {
		const race = live.currentRace;
		if (!race) return;

		untrack(() => {
			syncPlayers(race, requestedPlayers);
			syncMap(race, requestedMaps);
			applied = syncLabels(race, applied);
		});
	});
}

/** The selected JTOO tournament's index (getTournament falls back to the first one). */
function tournamentIndex(): number {
	const id = overlay.current.tournament;
	if (!id) return 0;
	return items.current.tournaments.findIndex((t) => t.id == id);
}

function updateTournament(update: (t: Tournament) => Tournament) {
	const index = tournamentIndex();
	if (index < 0 || !items.current.tournaments[index]) return;
	items.current.tournaments = items.current.tournaments.map((t, i) =>
		i === index ? update(t) : t
	);
}

function syncPlayers(race: RaceSnapshot, requested: Set<SteamID3>) {
	const onBoard = race.leaderboard.map((e) => e.steamId3);

	// add everyone on the board to the selected tournament
	const tournament = items.current.tournaments[tournamentIndex()];
	if (tournament) {
		const inTournament = new Set(tournament.players);
		const missing = onBoard.filter((id) => !inTournament.has(id));
		if (missing.length > 0) {
			updateTournament((t) => ({ ...t, players: [...t.players, ...missing] }));
		}
	}

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

	// add it to the selected tournament
	const tournament = items.current.tournaments[tournamentIndex()];
	if (tournament && !tournament.maps.includes(map)) {
		updateTournament((t) => ({ ...t, maps: [...t.maps, map] }));
	}

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

	if (stage && stage !== applied?.stage) {
		if (!items.current.stages.includes(stage)) {
			items.current.stages = [...items.current.stages, stage];
		}
		overlay.current.stage = stage;
	}
	if (map && map !== applied?.map) {
		overlay.current.map = map;
	}

	return { stage, map };
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
