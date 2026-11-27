import type { BestOf, BracketSize, Elimination, SteamID3 } from './types.svelte';

// MARK: Formats
// A format says where each match's two players come from: a seed, or the winner or loser of
// another match. Who is actually in a match is worked out from the seeding and the results,
// so nothing about players is stored per match.

type SourceText = `seed ${number}` | `winner ${string}` | `loser ${string}`;
// rounds in the order they're drawn, each holding its matches top to bottom, by match id
type HalfText = Record<string, Record<string, [SourceText, SourceText]>>;
type FormatText = {
	upper: HalfText;
	lower?: HalfText; // no lower half for single elimination
	bestOfs?: Record<string, BestOf>; // matches played over other than the usual best of
};

// every match is a best of 3 unless its format says otherwise
export const FORMAT_BEST_OF: BestOf = 3;

export type Source = { seed: number } | { winnerOf: string } | { loserOf: string };
export type MatchDef = { id: string; half: Half; A: Source; B: Source; bestOf: BestOf };
export type Round = { name: string; matches: MatchDef[] };
export type Half = 'upper' | 'lower';
export type Format = { upper: Round[]; lower: Round[]; matches: Record<string, MatchDef> };

function parseSource(text: SourceText): Source {
	const [kind, ref] = text.split(' ');
	if (kind == 'seed') return { seed: Number(ref) };
	if (kind == 'winner') return { winnerOf: ref };
	return { loserOf: ref };
}

// turns the readable form into a lookup by match id, and checks it for mistakes
function defineFormat(text: FormatText): Format {
	const format: Format = { upper: [], lower: [], matches: {} };

	for (const half of ['upper', 'lower'] as const) {
		for (const [name, matches] of Object.entries(text[half] ?? {})) {
			const round: Round = { name, matches: [] };
			for (const [id, [A, B]] of Object.entries(matches)) {
				if (format.matches[id]) throw new Error(`bracket format: match ${id} is defined twice`);
				const bestOf = text.bestOfs?.[id] ?? FORMAT_BEST_OF;
				const match = { id, half, A: parseSource(A), B: parseSource(B), bestOf };
				format.matches[id] = match;
				round.matches.push(match);
			}
			format[half].push(round);
		}
	}

	const seeds: number[] = [];
	const used = new Set<string>();
	for (const match of Object.values(format.matches)) {
		for (const source of [match.A, match.B]) {
			if ('seed' in source) {
				seeds.push(source.seed);
				continue;
			}
			const ref = 'winnerOf' in source ? source.winnerOf : source.loserOf;
			const use = 'winnerOf' in source ? `winner ${ref}` : `loser ${ref}`;
			if (!format.matches[ref]) {
				throw new Error(`bracket format: ${match.id} takes the ${use}, which doesn't exist`);
			}
			if (used.has(use)) throw new Error(`bracket format: the ${use} goes to two matches`);
			used.add(use);
		}
	}
	seeds.sort((a, b) => a - b);
	if (seeds.some((seed, i) => seed != i + 1)) {
		throw new Error(`bracket format: seeds must be 1 to ${seeds.length}, each used once`);
	}
	for (const id of Object.keys(text.bestOfs ?? {})) {
		if (!format.matches[id])
			throw new Error(`bracket format: ${id} has a best of but doesn't exist`);
	}

	return format;
}

const lower8: HalfText = {
	'Round 1': {
		LR1: ['loser QF1', 'loser QF2'],
		LR2: ['loser QF3', 'loser QF4']
	},
	'Quarter Finals': {
		LQF1: ['winner LR1', 'loser SF1'],
		LQF2: ['winner LR2', 'loser SF2']
	},
	'Semi Final': {
		LSF: ['winner LQF1', 'winner LQF2']
	},
	Final: {
		LF: ['winner LSF', 'loser F']
	}
};

// double elimination
const formats: Record<BracketSize, Format> = {
	4: defineFormat({
		upper: {
			'Quarter Finals': {
				QF1: ['seed 1', 'seed 4'],
				QF2: ['seed 2', 'seed 3']
			},
			'Semi Final': {
				SF: ['winner QF1', 'winner QF2']
			},
			'Grand Final': {
				GF: ['winner SF', 'winner LF']
			}
		},
		lower: {
			'Semi Final': {
				LSF: ['loser QF1', 'loser QF2']
			},
			Final: {
				LF: ['winner LSF', 'loser SF']
			}
		},
		bestOfs: { GF: 5 }
	}),

	8: defineFormat({
		upper: {
			'Quarter Finals': {
				QF1: ['seed 1', 'seed 8'],
				QF2: ['seed 4', 'seed 5'],
				QF3: ['seed 2', 'seed 7'],
				QF4: ['seed 3', 'seed 6']
			},
			'Semi Finals': {
				SF1: ['winner QF1', 'winner QF2'],
				SF2: ['winner QF3', 'winner QF4']
			},
			Final: {
				F: ['winner SF1', 'winner SF2']
			},
			'Grand Final': {
				GF: ['winner F', 'winner LF']
			}
		},
		lower: lower8,
		bestOfs: { GF: 5 }
	}),

	// the 8 player bracket, with play-ins for seeds 7 to 10. Play-in losers are out.
	10: defineFormat({
		upper: {
			'Play-In': {
				PI1: ['seed 8', 'seed 9'],
				PI2: ['seed 7', 'seed 10']
			},
			'Quarter Finals': {
				QF1: ['seed 1', 'winner PI1'],
				QF2: ['seed 4', 'seed 5'],
				QF3: ['seed 2', 'winner PI2'],
				QF4: ['seed 3', 'seed 6']
			},
			'Semi Finals': {
				SF1: ['winner QF1', 'winner QF2'],
				SF2: ['winner QF3', 'winner QF4']
			},
			Final: {
				F: ['winner SF1', 'winner SF2']
			},
			'Grand Final': {
				GF: ['winner F', 'winner LF']
			}
		},
		lower: lower8,
		bestOfs: { GF: 5 }
	})
};

// single elimination: the upper half of each double elimination bracket, with the last
// final deciding the winner instead of a grand final
const singleFormats: Record<BracketSize, Format> = {
	4: defineFormat({
		upper: {
			'Semi Finals': {
				SF1: ['seed 1', 'seed 4'],
				SF2: ['seed 2', 'seed 3']
			},
			Final: {
				F: ['winner SF1', 'winner SF2']
			}
		},
		// the last match decides the bracket, so it's played like a grand final
		bestOfs: { F: 5 }
	}),

	8: defineFormat({
		upper: {
			'Quarter Finals': {
				QF1: ['seed 1', 'seed 8'],
				QF2: ['seed 4', 'seed 5'],
				QF3: ['seed 2', 'seed 7'],
				QF4: ['seed 3', 'seed 6']
			},
			'Semi Finals': {
				SF1: ['winner QF1', 'winner QF2'],
				SF2: ['winner QF3', 'winner QF4']
			},
			Final: {
				F: ['winner SF1', 'winner SF2']
			}
		},
		// the last match decides the bracket, so it's played like a grand final
		bestOfs: { F: 5 }
	}),

	// the 8 player bracket, with play-ins for seeds 7 to 10
	10: defineFormat({
		upper: {
			'Play-In': {
				PI1: ['seed 8', 'seed 9'],
				PI2: ['seed 7', 'seed 10']
			},
			'Quarter Finals': {
				QF1: ['seed 1', 'winner PI1'],
				QF2: ['seed 4', 'seed 5'],
				QF3: ['seed 2', 'winner PI2'],
				QF4: ['seed 3', 'seed 6']
			},
			'Semi Finals': {
				SF1: ['winner QF1', 'winner QF2'],
				SF2: ['winner QF3', 'winner QF4']
			},
			Final: {
				F: ['winner SF1', 'winner SF2']
			}
		},
		// the last match decides the bracket, so it's played like a grand final
		bestOfs: { F: 5 }
	})
};

export function formatOf(b: { size: BracketSize; elimination?: Elimination }): Format {
	return (b.elimination == 'single' ? singleFormats : formats)[b.size];
}

// MARK: Results

export type Slot = 'A' | 'B';
export type Results = Record<string, SteamID3>; // match id -> who won
export type Games = Record<string, SteamID3[]>; // match id -> who won each game, in play order
export type MatchBestOfs = Record<string, BestOf>; // match id -> its best of, when changed from its format's

// the parts of a saved bracket that decide who plays who
export type BracketState = {
	size: BracketSize;
	elimination?: Elimination;
	bestOfs?: MatchBestOfs;
	players: SteamID3[];
	results?: Results;
	games?: Games;
};

export function playersOf(
	b: BracketState,
	id: string
): [SteamID3 | undefined, SteamID3 | undefined] {
	const match = formatOf(b).matches[id];
	return [playerFrom(b, match.A), playerFrom(b, match.B)];
}

function playerFrom(b: BracketState, source: Source): SteamID3 | undefined {
	if ('seed' in source) return b.players[source.seed - 1];
	if ('winnerOf' in source) return winnerOf(b, source.winnerOf);
	return loserOf(b, source.loserOf);
}

// a result only counts while the player who won is still in the match
export function winnerOf(b: BracketState, id: string): SteamID3 | undefined {
	const [A, B] = playersOf(b, id);
	const winner = b.results?.[id];
	return A && B && (winner == A || winner == B) ? winner : undefined;
}

export function loserOf(b: BracketState, id: string): SteamID3 | undefined {
	const winner = winnerOf(b, id);
	if (!winner) return undefined;
	const [A, B] = playersOf(b, id);
	return winner == A ? B : A;
}

/** Sets a match's winner outright, whatever its games say. */
export function setWinner(b: BracketState, id: string, slot: Slot) {
	const [A, B] = playersOf(b, id);
	if (!A || !B) return;
	b.results ??= {};
	b.results[id] = slot == 'A' ? A : B;
	prune(b);
}

/** Starts a match over: no winner and no games played. */
export function clearWinner(b: BracketState, id: string) {
	if (!b.results?.[id] && !b.games?.[id]) return;
	b.results = without(b.results ?? {}, id);
	b.games = without(b.games ?? {}, id);
	prune(b);
}

// entries are replaced rather than deleted: the saved state only notices assignments,
// so a delete wouldn't be saved or update the overlay until the next assignment
function without<T>(record: Record<string, T>, id: string): Record<string, T> {
	return Object.fromEntries(Object.entries(record).filter(([match]) => match != id));
}

// drops results and games that no longer count, so they can't come back if an earlier result
// changes back. One pass in any order is enough: a result that doesn't count never makes
// another one count. Games go after results, as dropping a result can change who's in a match.
function prune(b: BracketState) {
	const results = b.results ?? {};
	const counting = Object.keys(results).filter((id) => formatOf(b).matches[id] && winnerOf(b, id));
	if (counting.length != Object.keys(results).length) {
		b.results = Object.fromEntries(counting.map((id) => [id, results[id]]));
	}

	const games = b.games ?? {};
	let changed = false;
	const kept = Object.entries(games).flatMap(([id, winners]) => {
		const inMatch = formatOf(b).matches[id] ? gamesIn(b, id) : [];
		if (inMatch.length != winners.length) changed = true;
		return inMatch.length ? [[id, inMatch] as const] : [];
	});
	if (changed) b.games = Object.fromEntries(kept);
}

// MARK: Games
// A match is played over its best of: its format's (a best of 3, or 5 for the grand final),
// unless it's been changed for this bracket. Each game won counts towards the match, and the
// first player to win most of them wins the match.

/** The best of a match's format gives it. */
export const formatBestOf = (b: BracketState, id: string): BestOf =>
	formatOf(b).matches[id]?.bestOf ?? FORMAT_BEST_OF;
/** A match's best of: its own, when changed for this bracket, else its format's. */
export const bestOfOf = (b: BracketState, id: string): BestOf =>
	b.bestOfs?.[id] ?? formatBestOf(b, id);
export const winsNeeded = (b: BracketState, id: string) => Math.ceil(bestOfOf(b, id) / 2);

// the match's games won by players still in it
function gamesIn(b: BracketState, id: string): SteamID3[] {
	const [A, B] = playersOf(b, id);
	return (b.games?.[id] ?? []).filter((winner) => A && B && (winner == A || winner == B));
}

/** How many games each of the match's players has won. */
export function gameWins(b: BracketState, id: string): Record<Slot, number> {
	const [A, B] = playersOf(b, id);
	const games = gamesIn(b, id);
	return {
		A: games.filter((winner) => winner == A).length,
		B: games.filter((winner) => winner == B).length
	};
}

/** Gives a player a game, and the match once they've won enough. Nothing once it has a winner. */
export function addGame(b: BracketState, id: string, slot: Slot) {
	const [A, B] = playersOf(b, id);
	if (!A || !B || winnerOf(b, id)) return;
	b.games = { ...b.games, [id]: [...gamesIn(b, id), slot == 'A' ? A : B] };
	if (gameWins(b, id)[slot] >= winsNeeded(b, id)) setWinner(b, id, slot);
}

/** Takes a player's last game away, and the match with it if they no longer have enough. */
export function removeGame(b: BracketState, id: string, slot: Slot) {
	const [A, B] = playersOf(b, id);
	if (!A || !B) return;
	const player = slot == 'A' ? A : B;
	const games = gamesIn(b, id);
	const last = games.lastIndexOf(player);
	if (last == -1) return;
	b.games = { ...b.games, [id]: games.filter((_, i) => i != last) };
	if (winnerOf(b, id) == player && gameWins(b, id)[slot] < winsNeeded(b, id)) {
		b.results = without(b.results ?? {}, id);
		prune(b);
	}
}

/** Gives or takes a player's games until they've won `wins`, as far as the match allows. */
export function setGameWins(b: BracketState, id: string, slot: Slot, wins: number) {
	for (let have = gameWins(b, id)[slot]; have < wins; have++) {
		addGame(b, id, slot);
		if (gameWins(b, id)[slot] == have) return; // the match is decided
	}
	for (let have = gameWins(b, id)[slot]; have > wins; have--) removeGame(b, id, slot);
}

/**
 * Changes a match's best of, then decides it again from its games: a longer one takes back a
 * win the games no longer reach, and a shorter one gives the match to whoever first won enough.
 * A winner picked by hand, with no games won, stays.
 */
export function setBestOf(b: BracketState, id: string, bestOf: BestOf) {
	b.bestOfs =
		bestOf == formatBestOf(b, id) ? without(b.bestOfs ?? {}, id) : { ...b.bestOfs, [id]: bestOf };

	const [A, B] = playersOf(b, id);
	if (!A || !B) return;
	const needed = winsNeeded(b, id);
	const winner = winnerOf(b, id);
	if (winner) {
		const wins = gameWins(b, id)[winner == A ? 'A' : 'B'];
		if (wins > 0 && wins < needed) {
			b.results = without(b.results ?? {}, id);
			prune(b);
		}
		return;
	}
	const games = gamesIn(b, id);
	const decider = games.findIndex(
		(player, i) => games.slice(0, i + 1).filter((g) => g == player).length >= needed
	);
	if (decider != -1) setWinner(b, id, games[decider] == A ? 'A' : 'B');
}

/** The name of the round a match is in, eg: 'Grand Final', or 'Lower Final' in a lower half. */
export function roundNameOf(b: BracketState, id: string): string {
	const format = formatOf(b);
	const half = format.matches[id]?.half;
	if (!half) return '';
	const name = format[half].find((r) => r.matches.some((m) => m.id == id))?.name ?? '';
	return half == 'lower' ? `Lower ${name}` : name;
}
