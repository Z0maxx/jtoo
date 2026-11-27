import { overlay } from '$lib/storage.svelte';
import type { RaceSnapshot } from '$lib/websockets/console/live-types';

/**
 * 'clear mini leaderboard' in the controls hides the board between rounds: a race that started
 * before it isn't shown, so the board stays hidden until the next race starts.
 */
export function miniLeaderboardCleared(race: RaceSnapshot | undefined): boolean {
	return !!race && (race.window.startsAt ?? 0) < (overlay.current.miniLeaderboardClearedAt ?? 0);
}

/**
 * A single run race: everyone starts together and gets one run, so it's raced on map progress.
 * Mass-single races, and duels with no time limit (eg: bracket matches).
 */
export function isSingleRun(race: RaceSnapshot | undefined): boolean {
	return race?.mode === 'mass-single' || (race?.mode === 'duel' && race.window.endsAt === null);
}

/**
 * Whether the mini leaderboard shows: not for a time attack duel, as two players' PRs are
 * already on the match scene, but for a single run duel, to show both players' map progress.
 * Never once cleared.
 */
export function showsMiniLeaderboard(race: RaceSnapshot | undefined): race is RaceSnapshot {
	return !!race && (race.mode !== 'duel' || isSingleRun(race)) && !miniLeaderboardCleared(race);
}
