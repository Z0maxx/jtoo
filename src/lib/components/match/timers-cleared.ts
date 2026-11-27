import { overlay } from '$lib/storage.svelte';
import type { LeaderboardEntry, RaceSnapshot } from '$lib/websockets/console/live-types';

// 'clear timers' in the controls, in console time, so it compares with the race's timestamps
export const timersClearedAt = () => overlay.current.timersClearedAt ?? 0;

/**
 * A player's PR, unless it was set before 'clear timers': it shows for a race started since,
 * or when it came from a run started since. So the PRs read blank between rounds, like the
 * timers, until the players set new ones.
 */
export function prSinceClear(
	entry: LeaderboardEntry | undefined,
	race: RaceSnapshot | undefined
): number | null {
	if (!entry || entry.prMs === null) return null;
	const clearedAt = timersClearedAt();
	if ((race?.window.startsAt ?? 0) >= clearedAt) return entry.prMs;
	const fromRunSince =
		entry.lastRunMs === entry.prMs &&
		entry.runStartedAt !== null &&
		entry.runStartedAt >= clearedAt;
	return fromRunSince ? entry.prMs : null;
}
