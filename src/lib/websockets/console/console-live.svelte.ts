import { now } from '$lib/clock.svelte';
import { poolPlayers } from '$lib/console-pools.svelte';
import { overlay, settings } from '$lib/storage.svelte';
import { dummyPlayers, dummyRace, dummyTournament } from './dummy-live';
import type {
	IdleSnapshot,
	LeaderboardEntry,
	RaceSnapshot,
	TournamentSnapshot
} from './live-types';

export const DEFAULT_CONSOLE_URL = 'https://console.jumpfortress.tf';

export type FeedState = 'connecting' | 'open' | 'closed';

type Options = {
	/** Also follow a tournament stream: the race's tournament, or the pinned one. */
	tournament?: boolean;
	/**
	 * Show the race this many ms late (read from the timerDelayMs setting), so the overlay's
	 * timers line up with the in-game spectator, which is a little behind the console.
	 */
	delayRace?: boolean;
};

// How long to wait before reopening a stream the browser gave up on (a 401, 404 or 503,
// or the console being down when the page loaded). EventSource retries dropped
// connections by itself, but not refused ones.
const RETRY_MS = 5000;
// Snapshots per second the race stream asks for. Timers tick locally between them.
const RACE_INTERVAL_MS = 250;
// How often the dummy snapshots are rebuilt, so their race window never runs out.
const DUMMY_CYCLE_MS = 6 * 60_000;

/**
 * The console's live feeds for one page: the current race, and optionally a tournament.
 * Every (re)connect starts with a full snapshot, so nothing needs replaying.
 */
export class ConsoleLive {
	private liveRace: RaceSnapshot | IdleSnapshot | null = $state(null);
	private liveTournament: TournamentSnapshot | null = $state(null);
	/** serverTime - Date.now(), updated on every snapshot. */
	clockOffset = $state(0);
	raceState: FeedState = $state('closed');
	tournamentState: FeedState = $state('closed');
	/** A console tournament id to show instead of the race's own tournament. */
	pinnedTournamentId: string | null = $state(null);

	private readonly followTournament: boolean;
	private readonly delayRace: boolean;
	// the delay the shown race snapshot was held back by, so the clock runs that far behind too
	private raceDelayMs = $state(0);
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
	private raceDelayTimers = new Set<ReturnType<typeof setTimeout>>();
	// snapshots are numbered as they arrive, so a shorter delay set mid-race can't let an older
	// snapshot replace a newer one
	private raceReceived = 0;
	private raceShown = 0;
	private baseUrl = DEFAULT_CONSOLE_URL;
	private token = '';
	private raceSource: EventSource | undefined;
	private raceRetry: ReturnType<typeof setTimeout> | undefined;
	private tournamentSource: EventSource | undefined;
	private tournamentRetry: ReturnType<typeof setTimeout> | undefined;
	private tournamentSourceId: string | null = null;

	// MARK: dummy data
	// With 'use dummy data' on, race and tournament are static made-up snapshots instead of the
	// feeds'. The feeds stay connected underneath, so turning it off shows them straight away.
	// The board is the selected players and the pool, so nothing has to be fetched for it.
	private dummyCycle = $derived(
		settings.current.useDummyData ? Math.floor(now() / DUMMY_CYCLE_MS) : null
	);
	private dummyBoard = $derived(
		this.dummyCycle === null ? [] : dummyPlayers(overlay.current.players, poolPlayers())
	);
	private dummyRace = $derived.by(() => {
		if (this.dummyCycle === null) return null;
		const { map, stage } = overlay.current;
		return dummyRace(this.dummyBoard, { map, stage }, Date.now());
	});
	private dummyTournament = $derived(
		this.dummyCycle === null ? null : dummyTournament(this.dummyBoard, Date.now())
	);

	/** Whether race and tournament are dummy data, not the console's. */
	get dummy(): boolean {
		return this.dummyCycle !== null;
	}

	get race(): RaceSnapshot | IdleSnapshot | null {
		return this.dummy ? this.dummyRace : this.liveRace;
	}

	get tournament(): TournamentSnapshot | null {
		return this.dummy ? this.dummyTournament : this.liveTournament;
	}

	constructor(options: Options = {}) {
		this.followTournament = options.tournament ?? false;
		this.delayRace = options.delayRace ?? false;
	}

	/** Opens the feeds, or reopens them with a new token or console URL. */
	connect(token: string, baseUrl?: string) {
		this.token = token.trim();
		this.baseUrl = (baseUrl?.trim() || DEFAULT_CONSOLE_URL).replace(/\/+$/, '');
		this.openRace();
		this.tournamentSourceId = null;
		this.syncTournament();
	}

	close() {
		this.closeRace();
		this.closeTournament();
		this.tournamentSourceId = null;
	}

	/** Shows this console tournament instead of the race's own one. null follows the race. */
	pinTournament(id: string | null | undefined) {
		const pinned = id?.trim() || null;
		if (pinned === this.pinnedTournamentId) return;
		this.pinnedTournamentId = pinned;
		this.syncTournament();
	}

	/** The current race, or undefined when idle or not connected yet. */
	get currentRace(): RaceSnapshot | undefined {
		return this.race && this.race.sessionId !== null ? (this.race as RaceSnapshot) : undefined;
	}

	get tournamentId(): string | null {
		if (this.dummy) return this.dummyTournament?.tournamentId ?? null;
		return this.liveTournamentId;
	}

	/** The tournament the stream follows, whether or not dummy data is shown. */
	get liveTournamentId(): string | null {
		const race = this.liveRace?.sessionId !== null ? (this.liveRace as RaceSnapshot | null) : null;
		return this.pinnedTournamentId ?? race?.context.tournamentId ?? null;
	}

	/**
	 * The console's time now, ticking every animation frame, less the race's delay so running
	 * timers stay in step with the delayed snapshots. Dummy data runs on local time.
	 */
	serverNow(): number {
		return this.dummy ? now() : now() + this.clockOffset - this.raceDelayMs;
	}

	entryFor(steamId3: number | undefined): LeaderboardEntry | undefined {
		if (!steamId3) return undefined;
		return this.currentRace?.leaderboard.find((e) => e.steamId3 === steamId3);
	}

	/** leaderboard[0] if it has a PR or any progress. The console ranks by the same rule. */
	get leader(): LeaderboardEntry | undefined {
		const first = this.currentRace?.leaderboard[0];
		if (!first || first.status === 'disqualified' || first.status === 'withdrawn') return undefined;
		if (first.prMs === null && first.bestProgress.checkpointCount === 0) return undefined;
		return first;
	}

	private url(path: string, params: Record<string, string> = {}): string {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
		const url = new URL(path, this.baseUrl + '/');
		if (this.token) url.searchParams.set('token', this.token);
		for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
		return url.toString();
	}

	private onSnapshot(data: string): { serverTime: number } | undefined {
		try {
			const snapshot = JSON.parse(data);
			if (typeof snapshot.serverTime === 'number') {
				this.clockOffset = snapshot.serverTime - Date.now();
			}
			return snapshot;
		} catch (e) {
			console.error('console live: bad snapshot', e);
			return undefined;
		}
	}

	// MARK: race
	private openRace() {
		this.closeRace();
		if (typeof EventSource === 'undefined') return;

		const source = new EventSource(this.url('/live/race', { interval: `${RACE_INTERVAL_MS}` }));
		this.raceSource = source;
		this.raceState = 'connecting';

		source.onopen = () => (this.raceState = 'open');
		const onRace = (event: MessageEvent) => {
			const snapshot = this.onSnapshot(event.data);
			if (!snapshot) return;
			const seq = ++this.raceReceived;
			const delayMs = this.delayRace ? Math.max(0, settings.current.timerDelayMs || 0) : 0;
			const show = () => {
				if (seq < this.raceShown) return;
				this.raceShown = seq;
				this.raceDelayMs = delayMs;
				this.liveRace = snapshot as RaceSnapshot | IdleSnapshot;
				this.syncTournament();
			};
			if (!delayMs) return show();
			const timer = setTimeout(() => {
				this.raceDelayTimers.delete(timer);
				show();
			}, delayMs);
			this.raceDelayTimers.add(timer);
		};
		source.addEventListener('race', onRace);
		source.addEventListener('idle', onRace);
		source.onerror = () => {
			if (source.readyState === EventSource.CLOSED) {
				this.raceState = 'closed';
				this.raceRetry = setTimeout(() => this.openRace(), RETRY_MS);
			} else {
				this.raceState = 'connecting';
			}
		};
	}

	private closeRace() {
		clearTimeout(this.raceRetry);
		for (const timer of this.raceDelayTimers) clearTimeout(timer);
		this.raceDelayTimers.clear();
		this.raceSource?.close();
		this.raceSource = undefined;
		this.raceState = 'closed';
	}

	// MARK: tournament
	/** Opens, switches or closes the tournament stream to match tournamentId. */
	private syncTournament() {
		if (!this.followTournament || !this.raceSource) return;

		const id = this.liveTournamentId;
		if (id === this.tournamentSourceId) return;
		this.tournamentSourceId = id;

		this.closeTournament();
		this.liveTournament = null;
		if (id) this.openTournament(id);
	}

	private openTournament(id: string) {
		if (typeof EventSource === 'undefined') return;

		const source = new EventSource(this.url(`/live/tournament/${encodeURIComponent(id)}`));
		this.tournamentSource = source;
		this.tournamentState = 'connecting';

		source.onopen = () => (this.tournamentState = 'open');
		source.addEventListener('tournament', (event: MessageEvent) => {
			const snapshot = this.onSnapshot(event.data);
			if (snapshot) this.liveTournament = snapshot as TournamentSnapshot;
		});
		source.onerror = () => {
			if (source.readyState === EventSource.CLOSED) {
				this.tournamentState = 'closed';
				this.tournamentRetry = setTimeout(() => {
					if (this.tournamentSourceId === id) this.openTournament(id);
				}, RETRY_MS);
			} else {
				this.tournamentState = 'connecting';
			}
		};
	}

	private closeTournament() {
		clearTimeout(this.tournamentRetry);
		this.tournamentSource?.close();
		this.tournamentSource = undefined;
		this.tournamentState = 'closed';
	}
}
