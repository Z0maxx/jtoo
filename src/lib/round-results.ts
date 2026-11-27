import type { RaceSnapshot, TournamentRound } from '$lib/websockets/console/live-types';

/**
 * The tournament's rounds, with an unfinalized round's results filled in from its race while
 * that's the current race: the console only sends a round's results once it's finalized. They
 * follow the race's live positions. An unfinalized round whose race isn't the current one is
 * left with no results.
 */
export function withLiveResults(
	rounds: TournamentRound[],
	race: RaceSnapshot | undefined
): TournamentRound[] {
	return rounds.map((round) => {
		if (round.finalized || !race || race.sessionId !== round.sessionId) return round;
		const results = [...race.leaderboard]
			.sort((a, b) => a.position - b.position)
			.map((e) => ({
				placement: e.position,
				steamId3: e.steamId3,
				status: e.status,
				prMs: e.prMs,
				bestProgress: e.bestProgress
			}));
		return { ...round, results };
	});
}
