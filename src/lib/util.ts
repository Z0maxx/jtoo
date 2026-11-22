import { indexOf } from 'underscore';
import { items, overlay, settings } from './storage.svelte';
import { DEFAULT_CONSOLE_URL } from './websockets/console/console-live.svelte';
import {
	Player,
	TFMap,
	type Centiseconds,
	type MapFileName,
	type Seconds,
	type SteamID3,
	type TempusID
} from './types.svelte';
import { Steam } from './api/steam/api-steam';
import type {
	LeaderboardEntry as LiveLeaderboardEntry,
	RaceWindow
} from './websockets/console/live-types';

export function getPlayer(steamID3: SteamID3 | undefined): Player {
	if (!steamID3) return items.current.players[0];
	return { ...items.current.players.filter((p) => p.steamID3 == steamID3)[0] };
}
export function getPlayerByTempusID(tempusId: TempusID | undefined): Player {
	if (!tempusId) return items.current.players[0];
	return { ...items.current.players.filter((p) => p.tempusID == tempusId)[0] };
}
export function getPlayerIndex(steamID3: SteamID3 | undefined): number {
	if (!steamID3) return -1;
	return items.current.players.findIndex((p) => p.steamID3 == steamID3);
}
export function getPlayerIndexByTempusID(tempusID: TempusID | undefined): number {
	if (!tempusID) return -1;
	return items.current.players.findIndex((p) => p.tempusID == tempusID);
}

export async function addPlayersFromSteamID3(steamId3s: string[]) {
	// fetch player
	let playerSummaries = await Steam.fetchPlayerSummaries(steamId3s);
	if (!playerSummaries) return;

	for (const ps of playerSummaries) {
		let steamId3 = Steam.convertSteamId(ps.steamid, 'SteamID3') as number;

		if (getPlayer(steamId3).steamID3) continue;
		items.current.players.push(Steam.playerSummaryToPlayer(ps));
	}
	items.current.players = [...items.current.players];
}

export function getMap(mapFileName: MapFileName): TFMap {
	return { ...items.current.maps.filter((m) => m.fileName == mapFileName)[0] };
}

export function secondsToCs(seconds: Seconds): Centiseconds {
	return seconds * 100;
}

export function csToSeconds(centiseconds: Centiseconds): Seconds {
	return centiseconds / 100;
}

export function csToFormattedTime(
	cs: Centiseconds,
	precision?: 'centiseconds' | 'seconds' | 'minutes'
) {
	const minutes = Math.floor(cs / 6000)
		.toString()
		.padStart(2, '0');
	const seconds = Math.floor(csToSeconds(cs) % 60)
		.toString()
		.padStart(2, '0');
	const centiseconds = Math.floor(cs % 100)
		.toString()
		.padStart(2, '0');

	let s: string;
	if (!precision) {
		s = `${minutes}:${seconds}.${centiseconds}`;
	} else {
		s = `${minutes}`;
		s += precision == 'seconds' || precision == 'centiseconds' ? `:${seconds}` : '';
		s += precision == 'centiseconds' ? `.${centiseconds}` : '';
	}
	return s;
}

export function toPairs(m: unknown): [string, number][] {
	if (!m) return [];
	if (m instanceof Map) return [...m] as [string, number][];
	if (Array.isArray(m)) return m as [string, number][];
	return Object.entries(m as Record<string, number>);
}

export function sleep(ms: number) {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

export function deepCopy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value));
}

// MARK: console live feed
/** Formats integer ms like csToFormattedTime: mm:ss.cc, two decimals, truncated. */
export function msToFormattedTime(
	ms: number,
	precision?: 'centiseconds' | 'seconds' | 'minutes'
): string {
	return csToFormattedTime(Math.floor(Math.max(0, ms) / 10), precision);
}

/** A gap in seconds with two decimals and a sign, e.g. +1.23. A zero gap is shown as 0.00. */
export function msToGap(ms: number): string {
	const cs = Math.trunc(ms / 10);
	if (cs === 0) return '0.00';
	return (cs > 0 ? '+' : '-') + csToFormattedGap(Math.abs(cs));
}

function csToFormattedGap(cs: Centiseconds): string {
	// under a minute: 1.23, otherwise 1:02.34
	if (cs < 6000) return csToSeconds(cs).toFixed(2);
	const minutes = Math.floor(cs / 6000);
	const rest = (cs % 6000) / 100;
	return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`;
}

/** The run timer to show for a leaderboard entry: ticking while running, else the last run. */
export function runDisplayMs(
	entry: Pick<LiveLeaderboardEntry, 'runStartedAt' | 'runEndedAt' | 'lastRunMs'> | undefined,
	now: number
): number {
	if (!entry || entry.runStartedAt === null) return 0;
	if (entry.runEndedAt === null) return Math.max(0, now - entry.runStartedAt);
	return entry.lastRunMs ?? entry.runEndedAt - entry.runStartedAt;
}

/** Time left in a race window, clamped at 0. null when the race has no time limit. */
export function countdownMs(window: RaceWindow | undefined, now: number): number | null {
	if (!window || window.endsAt === null) return null;
	return Math.max(0, window.endsAt - now);
}

/** A player's name, or their SteamID3 if JTOO doesn't know them yet. */
export function playerLabel(steamID3: SteamID3, maxLength?: number): string {
	const name = getPlayer(steamID3).name || `[U:1:${steamID3}]`;
	if (maxLength && name.length > maxLength) return name.substring(0, maxLength) + '...';
	return name;
}

/** The console URL from settings, or the default. */
export function consoleBaseUrl(): string {
	return settings.current.consoleBaseUrl?.trim() || DEFAULT_CONSOLE_URL;
}
