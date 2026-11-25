import type {
	LeaderboardEntry,
	PlayerStatus,
	RaceSnapshot,
	RoundResultEntry,
	SteamID3,
	TournamentSnapshot
} from './live-types';

// Static stand-ins for the console's live feeds, used when 'use dummy data' is on, to lay out
// and check scenes without a race running. Built from players JTOO already knows, so names
// and avatars resolve. Run timers still tick locally from runStartedAt, like the real feed.

export const DUMMY_SESSION_ID = -1;
export const DUMMY_TOURNAMENT_ID = 'dummy';

const MAX_PLAYERS = 8;
const CHECKPOINTS = ['Checkpoint 1', 'Checkpoint 2', 'Checkpoint 3', 'Checkpoint 4'];
// where each checkpoint falls in a run, as a fraction of the run's time
const SPLIT_FRACTIONS = [0.22, 0.47, 0.71, 0.9];
// made-up account ids, to fill the board when JTOO knows fewer than two players
const FILLER_IDS: SteamID3[] = [900000001, 900000002];

type Row = {
	status: PlayerStatus;
	prMs: number | null;
	// a run in progress: how long ago it started, and how many checkpoints it has passed
	runAgoMs?: number;
	runCheckpoints?: number;
	// best progress for players without a PR
	checkpoints?: number;
};

// one row per board position: PRs close together, some players mid-run, one with only
// progress, one idle and one disqualified
const ROWS: Row[] = [
	{ status: 'running', prMs: 94_310, runAgoMs: 41_000, runCheckpoints: 2 },
	{ status: 'running', prMs: 95_870, runAgoMs: 12_000, runCheckpoints: 0 },
	{ status: 'idle', prMs: 97_240 },
	{ status: 'running', prMs: 99_050, runAgoMs: 77_000, runCheckpoints: 3 },
	{ status: 'idle', prMs: 103_620 },
	{ status: 'running', prMs: null, checkpoints: 2, runAgoMs: 30_000, runCheckpoints: 1 },
	{ status: 'disconnected', prMs: null, checkpoints: 1 },
	{ status: 'disqualified', prMs: 101_480 }
];

const splits = (runMs: number, count = CHECKPOINTS.length): (number | null)[] =>
	SPLIT_FRACTIONS.map((f, i) => (i < count ? Math.round(runMs * f) : null));

/** The board's players: the selected ones first, then the rest of the pool. */
export function dummyPlayers(selected: (SteamID3 | undefined)[], pool: SteamID3[]): SteamID3[] {
	const ids = [...new Set([...selected, ...pool].filter((id): id is SteamID3 => !!id))];
	for (const id of FILLER_IDS) if (ids.length < 2) ids.push(id);
	return ids.slice(0, MAX_PLAYERS);
}

/** A mass race four minutes into a ten minute window. */
export function dummyRace(
	players: SteamID3[],
	context: { map: string; stage: string },
	now: number
): RaceSnapshot {
	const leaderPr = ROWS[0].prMs!;
	const leaderboard: LeaderboardEntry[] = players.map((steamId3, i) => {
		const row = ROWS[i % ROWS.length];
		const running = row.runAgoMs !== undefined;
		const runStartedAt = running ? now - row.runAgoMs! : row.prMs !== null ? now - 90_000 : null;
		return {
			position: i + 1,
			steamId3,
			status: row.status,
			runStartedAt,
			runEndedAt: running || runStartedAt === null ? null : runStartedAt + (row.prMs ?? 0),
			lastRunMs: running ? null : row.prMs,
			prMs: row.prMs,
			prSplitsMs: row.prMs !== null ? splits(row.prMs) : CHECKPOINTS.map(() => null),
			currentSplitsMs: running
				? splits(row.prMs ?? 110_000, row.runCheckpoints)
				: CHECKPOINTS.map(() => null),
			bestProgress: {
				checkpointCount: row.prMs !== null ? CHECKPOINTS.length : (row.checkpoints ?? 0),
				timeMs:
					row.prMs !== null
						? row.prMs
						: row.checkpoints
							? Math.round(110_000 * SPLIT_FRACTIONS[row.checkpoints - 1])
							: null
			},
			gapToLeaderMs: i === 0 || row.prMs === null ? null : row.prMs - leaderPr
		};
	});

	return {
		revision: 1,
		serverTime: now,
		sessionId: DUMMY_SESSION_ID,
		mode: 'mass-multi',
		context: { tournamentId: DUMMY_TOURNAMENT_ID, stage: context.stage || null, map: context.map },
		roundIndex: 2,
		window: { state: 'racing', startsAt: now - 4 * 60_000, endsAt: now + 6 * 60_000 },
		checkpoints: CHECKPOINTS,
		leaderboard
	};
}

/**
 * Three rounds: two finalized, and the dummy race as the third, so the leaderboard scene shows
 * both finished results and a live round.
 */
export function dummyTournament(players: SteamID3[], now: number): TournamentSnapshot {
	const n = players.length;
	// each finalized round reshuffles the finishing order a little
	const orders = [
		players.map((_, i) => i),
		players.map((_, i) => (i % 2 === 0 ? Math.min(i + 1, n - 1) : i - 1))
	];

	const rounds = orders.map((order, roundIndex) => ({
		roundIndex,
		sessionId: DUMMY_SESSION_ID - 1 - roundIndex,
		map: '',
		stage: `Round ${roundIndex + 1}`,
		finalized: true,
		voided: false,
		results: order.map((playerIndex, placement): RoundResultEntry => ({
			placement: placement + 1,
			steamId3: players[playerIndex],
			status: 'finished',
			prMs: 92_000 + placement * 1_730 + roundIndex * 610,
			bestProgress: { checkpointCount: CHECKPOINTS.length, timeMs: null }
		}))
	}));

	const standings = players
		.map((steamId3) => {
			const placements = rounds.map(
				(r) => r.results.find((e) => e.steamId3 === steamId3)?.placement ?? null
			);
			const played = placements.filter((p): p is number => p !== null);
			const score = played.reduce((a, b) => a + b, 0) / Math.max(played.length, 1);
			return { steamId3, score, placements: [...placements, null] };
		})
		.sort((a, b) => a.score - b.score)
		.map((s, i) => ({ position: i + 1, ...s }));

	return {
		revision: 1,
		serverTime: now,
		tournamentId: DUMMY_TOURNAMENT_ID,
		name: 'Dummy Tournament',
		kind: 'mass',
		scoring: 'average-placement',
		rounds: [
			...rounds,
			{
				roundIndex: 2,
				sessionId: DUMMY_SESSION_ID,
				map: '',
				stage: 'Round 3',
				finalized: false,
				voided: false,
				results: []
			}
		],
		standings
	};
}
