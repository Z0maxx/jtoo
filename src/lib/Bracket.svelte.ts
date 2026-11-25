import type { BracketSize, SteamID3 } from './types.svelte';

// MARK: Formats
// A format says where each match's two players come from: a seed, or the winner or loser of
// another match. Who is actually in a match is worked out from the seeding and the results,
// so nothing about players is stored per match.

type SourceText = `seed ${number}` | `winner ${string}` | `loser ${string}`;
// rounds in the order they're drawn, each holding its matches top to bottom, by match id
type HalfText = Record<string, Record<string, [SourceText, SourceText]>>;
type FormatText = { upper: HalfText; lower: HalfText };

export type Source = { seed: number } | { winnerOf: string } | { loserOf: string };
export type MatchDef = { id: string; half: Half; A: Source; B: Source };
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
		for (const [name, matches] of Object.entries(text[half])) {
			const round: Round = { name, matches: [] };
			for (const [id, [A, B]] of Object.entries(matches)) {
				if (format.matches[id]) throw new Error(`bracket format: match ${id} is defined twice`);
				const match = { id, half, A: parseSource(A), B: parseSource(B) };
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

export const formats: Record<BracketSize, Format> = {
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
		}
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
		lower: lower8
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
		lower: lower8
	})
};

// MARK: Results

export type Slot = 'A' | 'B';
export type Results = Record<string, SteamID3>; // match id -> who won

// the parts of a saved bracket that decide who plays who
export type BracketState = { size: BracketSize; players: SteamID3[]; results?: Results };

export function playersOf(
	b: BracketState,
	id: string
): [SteamID3 | undefined, SteamID3 | undefined] {
	const match = formats[b.size].matches[id];
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

export function setWinner(b: BracketState, id: string, slot: Slot) {
	const [A, B] = playersOf(b, id);
	if (!A || !B) return;
	b.results ??= {};
	b.results[id] = slot == 'A' ? A : B;
	pruneResults(b);
}

export function clearWinner(b: BracketState, id: string) {
	if (!b.results) return;
	delete b.results[id];
	pruneResults(b);
}

// drops results that no longer count, so they can't come back if an earlier result changes back.
// One pass in any order is enough: a result that doesn't count never makes another one count.
function pruneResults(b: BracketState) {
	for (const id of Object.keys(b.results ?? {})) {
		if (!formats[b.size].matches[id] || !winnerOf(b, id)) delete b.results![id];
	}
}
