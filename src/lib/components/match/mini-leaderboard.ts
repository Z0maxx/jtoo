import { overlay } from '$lib/storage.svelte';
import type { RaceSnapshot } from '$lib/websockets/console/live-types';

/**
 * 'clear mini leaderboard' in the controls hides the board between rounds: a race that started
 * before it isn't shown, so the board stays hidden until the next race starts.
 */
export function miniLeaderboardCleared(race: RaceSnapshot | undefined): boolean {
	return !!race && (race.window.startsAt ?? 0) < (overlay.current.miniLeaderboardClearedAt ?? 0);
}
