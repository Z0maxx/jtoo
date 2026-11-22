import { items, pool, settings } from './storage.svelte';
import { consoleBaseUrl } from './util';
import { Player, TFMap, type MapFileName, type SteamID3 } from './types.svelte';
import { Tempus2 } from './api/tempus2/api-tempus2';
import jumpOdysseyRc3 from './assets/jump_odyssey_rc3.png';

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
type ConsoleMapPool = {
	id: string;
	name: string;
	maps: { id: string; name: string; displayName: string | null; position: number }[];
};

// our own images for maps whose Tempus image is missing or wrong; they replace the map's
// image on every import, so maps saved before the override existed pick it up too
const MAP_IMAGE_OVERRIDES: Record<MapFileName, string> = {
	jump_odyssey_rc3: jumpOdysseyRc3
};

export type PoolImportResult = {
	players: number;
	maps: number;
	errors: string[];
};

async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(new URL(path, consoleBaseUrl() + '/'));
	if (!response.ok) throw new Error(`${path}: ${response.status}`);
	return response.json();
}

/**
 * Imports the configured player pool and map pool from the console: the players and maps
 * are added to JTOO (or updated, for players it already has) and become the lists the
 * controls pick from. Safe to run on every startup.
 */
export async function importConsolePools(): Promise<PoolImportResult> {
	const result: PoolImportResult = { players: 0, maps: 0, errors: [] };

	try {
		result.players = await importPlayerPool(DEFAULT_PLAYER_POOL_ID);
	} catch (e) {
		result.errors.push(`player pool: ${e instanceof Error ? e.message : e}`);
	}
	try {
		result.maps = await importMapPool(DEFAULT_MAP_POOL_ID);
	} catch (e) {
		result.errors.push(`map pool: ${e instanceof Error ? e.message : e}`);
	}

	for (const error of result.errors) console.error('console pools:', error);
	return result;
}

async function importPlayerPool(poolId: string): Promise<number> {
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

	const ids = poolPlayers.map((p) => Number(p.steamAccountId));
	pool.current = { ...pool.current, players: ids, playerPoolName: group.name };
	return ids.length;
}

async function importMapPool(poolId: string): Promise<number> {
	const { mapPools } = await getJson<{ mapPools: ConsoleMapPool[] }>('/api/map-pools');
	const mapPool = mapPools.find((p) => p.id === poolId);
	if (!mapPool) throw new Error(`no map pool with id ${poolId}`);

	const names: MapFileName[] = [...mapPool.maps]
		.sort((a, b) => a.position - b.position)
		.map((m) => m.name.trim());
	pool.current = { ...pool.current, maps: names, mapPoolName: mapPool.name };

	// add maps JTOO doesn't have, from Tempus when it knows them
	await Promise.all(
		names.filter((name) => !items.current.maps.some((m) => m.fileName == name)).map(addMap)
	);
	applyMapImageOverrides(names);
	return names.length;
}

function applyMapImageOverrides(names: MapFileName[]) {
	const needsOverride = (m: TFMap) =>
		names.includes(m.fileName) &&
		MAP_IMAGE_OVERRIDES[m.fileName] &&
		m.imageURL !== MAP_IMAGE_OVERRIDES[m.fileName];
	if (!items.current.maps.some(needsOverride)) return;
	items.current.maps = items.current.maps.map((m) =>
		needsOverride(m) ? { ...m, imageURL: MAP_IMAGE_OVERRIDES[m.fileName] } : m
	);
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
