import { untrack } from 'svelte';
import { formatOf, playersOf, setWinner, winnerOf, type BracketState } from './Bracket.svelte';
import type { SavedBracket } from './types.svelte';
import { items, overlay } from './storage.svelte';
import type { ConsoleLive } from './websockets/console/console-live.svelte';
import type { RaceSnapshot } from './websockets/console/live-types';

// A bracket match is played as a console duel race. The race's two racers say which match it
// is, and the race's result says who won it.

const underway = (race: RaceSnapshot) => race.window.state !== 'ended';

/**
 * The match a duel race is for: the first one, in the bracket's order, whose two players are
 * the race's two racers and that has no winner yet. A rematch (eg: the grand final) has the
 * same players as an earlier match, but that one already has a winner.
 */
function matchForRace(b: BracketState, race: RaceSnapshot): string | undefined {
	if (race.mode !== 'duel') return undefined;
	const racers = race.leaderboard.map((e) => e.steamId3);
	if (racers.length !== 2) return undefined;
	return Object.keys(formatOf(b).matches).find((id) => {
		const [A, B] = playersOf(b, id);
		return A && B && racers.includes(A) && racers.includes(B) && !winnerOf(b, id);
	});
}

/**
 * The live match: the one picked by middle clicking it, else the one being raced right now.
 * A match stops being live once it has a winner.
 */
export function liveMatch(b: SavedBracket, race: RaceSnapshot | undefined): string | undefined {
	const pin = overlay.current.bracketLive;
	const id = pin?.bracket === b.id ? pin.match : race && underway(race) && matchForRace(b, race);
	return id && !winnerOf(b, id) ? id : undefined;
}

/** Makes a match the only live one, or no match live when it already is. */
export function toggleLive(b: SavedBracket, id: string, race: RaceSnapshot | undefined) {
	const match = liveMatch(b, race) === id ? null : id;
	overlay.current.bracketLive = { bracket: b.id, match };
}

// the duel's winner: the best placed racer who finished. Nobody when neither finished
function raceWinner(race: RaceSnapshot) {
	return [...race.leaderboard]
		.sort((a, b) => a.position - b.position)
		.find((e) => e.status === 'finished')?.steamId3;
}

// the bracket picked in the controls
const currentBracket = () => items.current.brackets?.find((b) => b.id == overlay.current.bracket);

/**
 * Sets a bracket match's winner when the duel race for it ends, on the bracket picked in the
 * controls. Only races seen underway here count, so reloading the overlay after a race doesn't
 * apply its result again over a winner picked by hand; clicking a match still overrides it.
 *
 * Call it once during component initialisation, on the overlay page, so it runs whichever
 * scene is showing.
 */
export function syncBracketResults(live: ConsoleLive) {
	// races seen underway, and so still to be applied when they end
	let watching: number | undefined;

	$effect(() => {
		const race = live.currentRace;
		// dummy data never changes JTOO's own state
		if (!race || live.dummy) return;
		const state = race.window.state;

		untrack(() => {
			if (state !== 'ended') {
				if (watching !== race.sessionId) {
					watching = race.sessionId;
					// a new race for a bracket match goes back to following the races
					const bracket = currentBracket();
					if (bracket && matchForRace(bracket, race)) overlay.current.bracketLive = undefined;
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
			setWinner(bracket, id, winner == A ? 'A' : 'B');
		});
	});
}
