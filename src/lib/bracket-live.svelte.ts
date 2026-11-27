import { untrack } from 'svelte';
import { addGame, formatOf, playersOf, winnerOf, type BracketState } from './Bracket.svelte';
import type { SavedBracket, SteamID3 } from './types.svelte';
import { autoSelectPlayers, items, overlay } from './storage.svelte';
import type { ConsoleLive } from './websockets/console/console-live.svelte';
import type { RaceSnapshot } from './websockets/console/live-types';
import { isSingleRun } from './components/match/mini-leaderboard';

// A bracket match is played as console duel races, one per game. The race's two racers say
// which match it is, and the race's result says who won the game.

const underway = (race: RaceSnapshot) => race.window.state !== 'ended';

// the bracket picked in the controls
export const currentBracket = () =>
	items.current.brackets?.find((b) => b.id == overlay.current.bracket);

// every match between two players, in the bracket's order
function matchesBetween(b: BracketState, x: SteamID3 | undefined, y: SteamID3 | undefined) {
	if (!x || !y || x == y) return [];
	return Object.keys(formatOf(b).matches).filter((id) => {
		const [A, B] = playersOf(b, id);
		return A && B && [A, B].includes(x) && [A, B].includes(y);
	});
}

/**
 * The match a duel race is for: the first one, in the bracket's order, whose two players are
 * the race's two racers and that has no winner yet. A rematch (eg: the grand final) has the
 * same players as an earlier match, but that one already has a winner.
 */
function matchForRace(b: BracketState, race: RaceSnapshot): string | undefined {
	if (race.mode !== 'duel') return undefined;
	const racers = race.leaderboard.map((e) => e.steamId3);
	if (racers.length !== 2) return undefined;
	return matchesBetween(b, racers[0], racers[1]).find((id) => !winnerOf(b, id));
}

/**
 * The current bracket's match between two players: the one picked as live, else the one
 * they're playing (no winner yet), else the last one they played, so its score still shows
 * once it's won.
 */
export function bracketMatchBetween(
	x: SteamID3 | undefined,
	y: SteamID3 | undefined
): { bracket: SavedBracket; id: string } | undefined {
	const bracket = currentBracket();
	if (!bracket) return undefined;
	const ids = matchesBetween(bracket, x, y);
	const pin = overlay.current.bracketLive;
	const pinned = pin?.bracket === bracket.id && pin.match ? pin.match : undefined;
	const id =
		ids.find((id) => id === pinned) ?? ids.find((id) => !winnerOf(bracket, id)) ?? ids.at(-1);
	if (id && isDeselected(bracket, id)) return undefined;
	return id ? { bracket, id } : undefined;
}

/**
 * The live match: the one picked by middle clicking it, else the one being raced right now,
 * else one part way through its games. A match stops being live once it has a winner.
 */
export function liveMatch(b: SavedBracket, race: RaceSnapshot | undefined): string | undefined {
	const pin = overlay.current.bracketLive;
	const id =
		pin?.bracket === b.id
			? pin.match
			: (race && underway(race) && matchForRace(b, race)) ||
				Object.keys(b.games ?? {}).find((id) => b.games![id].length && !winnerOf(b, id));
	return id && !winnerOf(b, id) ? id : undefined;
}

const isDeselected = (b: SavedBracket, id: string) => {
	const deselected = overlay.current.bracketDeselected;
	return deselected?.bracket === b.id && deselected.match === id;
};

/**
 * Deselects a match: its score stops showing for its players and no match is live, until it's
 * made live again or the next race for it starts. Its games still count meanwhile.
 */
export function deselectMatch(b: SavedBracket, id: string) {
	// one write, so the overlay sees both together
	overlay.current = {
		...overlay.current,
		bracketLive: { bracket: b.id, match: null },
		bracketDeselected: { bracket: b.id, match: id }
	};
}

/**
 * Makes a match the only live one, or no match live when it already is. Making one live also
 * selects its two players, which spectates them in-game and shows their games won.
 */
export function toggleLive(b: SavedBracket, id: string, race: RaceSnapshot | undefined) {
	const match = liveMatch(b, race) === id ? null : id;
	overlay.current.bracketLive = { bracket: b.id, match };
	if (match && isDeselected(b, match)) overlay.current.bracketDeselected = undefined;
	if (match) selectPlayers(b, match);
}

// selects a match's players as A and B, unless they're already selected the other way round,
// so they don't swap sides
function selectPlayers(b: BracketState, id: string) {
	const [A, B] = playersOf(b, id);
	if (!A || !B) return;
	const [first, second] = overlay.current.players;
	if (first == B && second == A) return;
	autoSelectPlayers(A, B, `live ${id}`);
}

// the duel's winner: the best placed racer who finished. Nobody when neither finished
function raceWinner(race: RaceSnapshot) {
	return [...race.leaderboard]
		.sort((a, b) => a.position - b.position)
		.find((e) => e.status === 'finished')?.steamId3;
}

// a single run duel is won by whoever finishes first, so it's decided then, without waiting for
// the race to end. A timed duel is decided by the best time once it ends
const decided = (race: RaceSnapshot) =>
	race.window.state === 'ended' || (isSingleRun(race) && raceWinner(race) !== undefined);

/**
 * Gives a bracket match's game to its winner once the duel race for it is decided (the first
 * finish of a single run duel, else the race ending), on the bracket
 * picked in the controls; the match is won once a player has won most of its best of. Only
 * races seen undecided here count, so reloading the controls after a race doesn't apply its
 * result again; the controls' score pips and clicking a match still override it.
 *
 * Call it once during component initialisation, on the controls page: there's only ever one,
 * where each overlay source would count the game again.
 */
export function syncBracketResults(live: ConsoleLive) {
	// races seen undecided, and so still to be applied once decided
	let watching: number | undefined;

	$effect(() => {
		const race = live.currentRace;
		// dummy data never changes JTOO's own state
		if (!race || live.dummy) return;

		untrack(() => {
			if (!decided(race)) {
				if (watching !== race.sessionId) {
					watching = race.sessionId;
					// a new race for a bracket match goes back to following the races
					const bracket = currentBracket();
					// and shows the match again if it was deselected
					if (bracket && matchForRace(bracket, race)) {
						overlay.current = {
							...overlay.current,
							bracketLive: undefined,
							bracketDeselected: undefined
						};
					}
				}
				return;
			}
			if (watching !== race.sessionId) return;
			watching = undefined;

			const bracket = currentBracket();
			const winner = raceWinner(race);
			if (!bracket || winner === undefined) return;
			const id = matchForRace(bracket, race);
			if (!id) return;
			const [A] = playersOf(bracket, id);
			addGame(bracket, id, winner == A ? 'A' : 'B');
		});
	});
}
