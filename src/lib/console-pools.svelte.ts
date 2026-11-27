import { items, pool, settings } from './storage.svelte';
import { consoleBaseUrl } from './util';
import { Player, TFMap, type MapFileName, type MapRun, type SteamID3 } from './types.svelte';
import { Tempus2 } from './api/tempus2/api-tempus2';
import { mapImageOverride } from './map-image-overrides';

// The event's players and maps come from a console player pool and map pool. These are
// the console's public endpoints, so no token is needed.
export const DEFAULT_PLAYER_POOL_ID = '1c480fdb-3f06-49b5-9ffb-bee359e26726'; // Jump4Charity
export const DEFAULT_MAP_POOL_ID = '37c7b889-ecc5-4603-9bcd-1a52633cf9dd'; // Jump4Charity Royale

type ConsolePlayer = {
	id: string;
	displayName: string;
	personaName: string;
	steamId64: string;
	steamAccountId: string;
	avatarUrl: string;
	countryCode: string | null;
};
type ConsolePlayerGroup = { id: string; name: string; playerIds: string[] };
export type ConsoleMapPool = {
	id: string;
	name: string;
	maps: { id: string; name: string; displayName: string | null; position: number }[];
};

export type PoolImportResult = {
	players: number;
	maps: number;
	errors: string[];
};

export async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(new URL(path, consoleBaseUrl() + '/'));
	if (!response.ok) throw new Error(`${path}: ${response.status}`);
	return response.json();
}

export type PoolIds = { playerPoolId?: string | null; mapPoolId?: string | null };

// bumped by each import, so an earlier import that finishes late can't replace the pools of a
// later one (eg: the live tournament changed twice in quick succession)
let importRun = 0;

/**
 * Imports a player pool and map pool from the console, by default the event's: the players
 * and maps are added to JTOO (or updated, for players it already has) and become the lists
 * the controls pick from. A pool id left out or null uses the default. Safe to run on every
 * startup.
 */
export async function importConsolePools(ids: PoolIds = {}): Promise<PoolImportResult> {
	const run = ++importRun;
	const stale = () => run !== importRun;
	const result: PoolImportResult = { players: 0, maps: 0, errors: [] };

	let poolPlayers: ConsolePlayer[] = [];
	try {
		poolPlayers = await importPlayerPool(ids.playerPoolId || DEFAULT_PLAYER_POOL_ID, stale);
		result.players = poolPlayers.length;
	} catch (e) {
		result.errors.push(`player pool: ${e instanceof Error ? e.message : e}`);
	}
	try {
		result.maps = await importMapPool(ids.mapPoolId || DEFAULT_MAP_POOL_ID, stale);
	} catch (e) {
		result.errors.push(`map pool: ${e instanceof Error ? e.message : e}`);
	}

	// in the background, so the import isn't held up by Tempus lookups
	if (!stale()) fillTempusData(poolPlayers);

	for (const error of result.errors) console.error('console pools:', error);
	return result;
}

/** The pool's players, added to JTOO or updated. */
async function importPlayerPool(poolId: string, stale: () => boolean): Promise<ConsolePlayer[]> {
	const [{ groups }, { players }] = await Promise.all([
		getJson<{ groups: ConsolePlayerGroup[] }>('/api/player-groups'),
		getJson<{ players: ConsolePlayer[] }>('/api/players')
	]);
	const group = groups.find((g) => g.id === poolId);
	if (!group) throw new Error(`no player pool with id ${poolId}`);

	const byId = new Map(players.map((p) => [p.id, p]));
	const poolPlayers = group.playerIds
		.map((id) => byId.get(id))
		.filter((p): p is ConsolePlayer => !!p && !!Number(p.steamAccountId));

	// update players JTOO already has, keeping JTOO-only details like tags and notes
	const updated = [...items.current.players];
	for (const cp of poolPlayers) {
		const steamID3: SteamID3 = Number(cp.steamAccountId);
		const index = updated.findIndex((p) => p.steamID3 == steamID3);
		const player: Player = index >= 0 ? { ...updated[index] } : new Player();
		player.steamID3 = steamID3;
		player.steamID = cp.steamId64;
		player.name = cp.displayName || cp.personaName;
		if (cp.avatarUrl) player.avatarURL = cp.avatarUrl;
		if (cp.countryCode) player.flag = cp.countryCode.toLowerCase();

		if (index >= 0) updated[index] = player;
		else updated.push(player);
	}
	items.current.players = updated;

	// the players are still added, but the pool stays the newer import's
	if (stale()) return poolPlayers;
	const ids = poolPlayers.map((p) => Number(p.steamAccountId));
	pool.current = { ...pool.current, players: ids, playerPoolName: group.name };
	return poolPlayers;
}

// bumped by each import, so a re-import stops the previous one's lookups instead of
// running alongside them
let tempusRun = 0;

// player stats and map PRs fetched more recently than this are kept as they are, so reloading
// the controls doesn't ask Tempus for everything again
const TEMPUS_REFRESH_MS = 6 * 60 * 60 * 1000;
const isFresh = (fetchedAt: number | undefined) =>
	!!fetchedAt && Date.now() - fetchedAt < TEMPUS_REFRESH_MS;

/**
 * Refreshes what JTOO keeps from Tempus on every import: the pool players' stats, then the
 * pool maps' PRs. The PRs come second because they're matched to players by the Tempus IDs
 * the stats lookup finds.
 */
async function fillTempusData(poolPlayers: ConsolePlayer[]) {
	const run = ++tempusRun;
	await fillTempusStats(poolPlayers, run);
	if (run === tempusRun) await fillMapPrs(run);
}

/**
 * The pool players' Tempus ranks, WRs and TTs, unless fetched recently. Players JTOO has a
 * Tempus ID for are fetched directly; the rest are found by Steam ID first. The Tempus calls
 * are queued and paced by the API clients.
 */
async function fillTempusStats(poolPlayers: ConsolePlayer[], run: number) {
	for (const cp of poolPlayers) {
		if (run !== tempusRun) return;
		const steamID3: SteamID3 = Number(cp.steamAccountId);
		const existing = items.current.players.find((p) => p.steamID3 == steamID3);
		if (!existing) continue;
		if (existing.tempusID && isFresh(existing.tempusFetchedAt)) continue;

		let stats: Player | null = null;
		try {
			stats = existing.tempusID
				? await Tempus2.fetchPlayerByTempusID(existing.tempusID)
				: await Tempus2.fetchPlayerBySteamID3(steamID3, [
						existing.name,
						cp.displayName,
						cp.personaName
					]);
		} catch (e) {
			console.error(`console pools: tempus stats for ${existing.name} failed`, e);
		}
		if (!stats) {
			console.warn(`console pools: ${existing.name} not found on Tempus`);
			continue;
		}

		if (run !== tempusRun) return;

		// only the Tempus details: the name, flag and avatar stay as the console has them.
		// looked up again by steamID3, since the list may have changed during the fetch
		const index = items.current.players.findIndex((p) => p.steamID3 == steamID3);
		if (index < 0) continue;
		const updated = [...items.current.players];
		updated[index] = {
			...updated[index],
			tempusID: stats.tempusID,
			rank: stats.rank,
			WRs: stats.WRs,
			TTs: stats.TTs,
			tempusFetchedAt: Date.now()
		};
		items.current.players = updated;
	}
}

/**
 * Each pool map's PRs for the player card scene's comparisons. Tempus lists every record on
 * a map, so only the pool players' runs are kept, to keep the saved maps small. A map fetched
 * recently is skipped, unless a pool player has a Tempus ID it wasn't fetched for.
 */
async function fillMapPrs(run: number) {
	const tempusIDs = new Set(
		items.current.players
			.filter((p) => pool.current.players?.includes(p.steamID3))
			.map((p) => p.tempusID)
			.filter((id): id is number => !!id)
	);
	if (!tempusIDs.size) return;

	for (const name of pool.current.maps ?? []) {
		if (run !== tempusRun) return;
		const map = items.current.maps.find((m) => m.fileName == name);
		// a map Tempus doesn't know has no zone to list records for
		if (!map?.mapZoneId) continue;
		const fetchedFor = new Set(map.runsFetchedFor ?? []);
		const covered = [...tempusIDs].every((id) => fetchedFor.has(id));
		if (covered && isFresh(map.runsFetchedAt)) continue;

		// fetched into a fresh list, since fetchMapPrs adds to the map's runs
		const fetched = { ...map, runs: { soldier: [], demoman: [] } } as TFMap;
		try {
			await Tempus2.fetchMapPrs(fetched);
		} catch (e) {
			console.error(`console pools: tempus PRs for ${name} failed`, e);
			continue;
		}
		if (run !== tempusRun) return;

		const keep = (runs: MapRun[]) => runs.filter((r) => tempusIDs.has(r.tempusID));
		items.current.maps = items.current.maps.map((m) =>
			m.fileName == name
				? {
						...m,
						runs: { soldier: keep(fetched.runs.soldier), demoman: keep(fetched.runs.demoman) },
						runsFetchedAt: Date.now(),
						runsFetchedFor: [...tempusIDs]
					}
				: m
		);
	}
}

async function importMapPool(poolId: string, stale: () => boolean): Promise<number> {
	const { mapPools } = await getJson<{ mapPools: ConsoleMapPool[] }>('/api/map-pools');
	const mapPool = mapPools.find((p) => p.id === poolId);
	if (!mapPool) throw new Error(`no map pool with id ${poolId}`);

	const names: MapFileName[] = [...mapPool.maps]
		.sort((a, b) => a.position - b.position)
		.map((m) => m.name.trim());
	if (!stale()) pool.current = { ...pool.current, maps: names, mapPoolName: mapPool.name };

	// the pool's maps first, as the controls pick from them, then every other pool's, so they're
	// all saved for when a tournament with another pool goes live. The others are added in the
	// background, so the import isn't held up by their Tempus lookups
	await addMissingMaps(names);
	const others = [
		...new Set(mapPools.flatMap((p) => p.maps.map((m) => m.name.trim())).filter(Boolean))
	].filter((name) => !names.includes(name));
	addMissingMaps(others);
	return names.length;
}

/** Adds the maps JTOO doesn't have, from Tempus when it knows them. */
async function addMissingMaps(names: MapFileName[]) {
	await Promise.all(
		names.filter((name) => !items.current.maps.some((m) => m.fileName == name)).map(addMap)
	);
	applyMapFixes(names);
}

/**
 * Brings saved maps up to date with rules added since they were saved: the pool maps' image
 * overrides, and every map's short name where the rules for it have changed (jump_bb_ maps).
 */
function applyMapFixes(names: MapFileName[]) {
	const fix = (m: TFMap): TFMap => {
		const url = mapImageOverride(m.fileName);
		const imageURL = names.includes(m.fileName) && url !== undefined ? url : m.imageURL;
		const shortName = TFMap.hasOwnShortNameRule(m.fileName)
			? TFMap.fileNameToShortName(m.fileName)
			: m.shortName;
		return imageURL === m.imageURL && shortName === m.shortName ? m : { ...m, imageURL, shortName };
	};
	const fixed = items.current.maps.map(fix);
	if (fixed.some((m, i) => m !== items.current.maps[i])) items.current.maps = fixed;
}

async function addMap(fileName: MapFileName) {
	let map: TFMap | null = null;
	try {
		map = await Tempus2.fetchMapByName(fileName);
	} catch (e) {
		console.error(`console pools: ${fileName} not found on Tempus`, e);
	}
	if (!map) {
		map = new TFMap();
		map.fileName = fileName;
		map.shortName = TFMap.fileNameToShortName(fileName);
	}
	const added = map;
	if (items.current.maps.some((m) => m.fileName == added.fileName)) return;
	items.current.maps = [...items.current.maps, added];
}

/**
 * The players the controls pick from: the imported pool's players that JTOO still has, so a
 * deleted player drops out (importing again brings them back). Every player JTOO has when
 * nothing from the pool is left.
 */
export function poolPlayers(): SteamID3[] {
	const known = items.current.players.map((p) => p.steamID3).filter(Boolean);
	const inPool = (pool.current.players ?? []).filter((id) => known.includes(id));
	return inPool.length ? inPool : known;
}

/** The maps the controls pick from, on the same rules as poolPlayers. */
export function poolMaps(): MapFileName[] {
	const known = items.current.maps.map((m) => m.fileName).filter(Boolean);
	const inPool = (pool.current.maps ?? []).filter((name) => known.includes(name));
	return inPool.length ? inPool : known;
}
