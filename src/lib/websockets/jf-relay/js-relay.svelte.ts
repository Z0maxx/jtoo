import { ProxyWebSocket } from '$lib/ProxyWebSocket';
import { consoleBaseUrl } from '$lib/util';
import type { SteamID3 } from '$lib/types.svelte';
import type { LeaderboardEntry } from '$lib/websockets/console/live-types';

interface JFRelayEvent {
	type: 'spectator_select' | 'overlay_connected';
}

interface JFRelaySpectatorSelectEvent extends JFRelayEvent {
	type: 'spectator_select';
	value: {
		playerA: number | null; // numeric part of steamid3
		playerB: number | null; // numeric part of steamid3
	};
}

interface JFRelayWelcomeEvent extends JFRelayEvent {
	type: 'overlay_connected';
	value: string;
}

type JFRelayEvents = JFRelaySpectatorSelectEvent | JFRelayWelcomeEvent;

// A game server's latest progress through the map, relayed by the console. Copied from
// jf-console backend/progress-protocol.ts. A server that stops publishing is sent again with
// no players.
export interface RelayProgress {
	type: 'relay_progress';
	protocol: 1;
	totalProgressLevels: number; // how many levels the map has; 0 when unknown
	map: string;
	server_code: string;
	userids: number[]; // the running players' userids, furthest through the map first
	players: {
		userid: number;
		account: SteamID3;
		attempt: number;
		level: number;
		running: boolean;
	}[];
}

// sent on connect, before the servers' current snapshots
interface RelayProgressReset {
	type: 'relay_progress_reset';
}

/**
 * The running players, furthest through the map first. Each server ranks its own players; the
 * servers' rankings are merged by level, keeping every server's own order.
 */
export function progressOrder(snapshots: RelayProgress[]): SteamID3[] {
	const ranked = snapshots.map((s) => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
		const byUserid = new Map(s.players.map((p) => [p.userid, p]));
		return s.userids.map((id) => byUserid.get(id)!).filter(Boolean);
	});

	const order: SteamID3[] = [];
	for (;;) {
		let best = -1;
		for (let i = 0; i < ranked.length; i++) {
			if (ranked[i].length && (best < 0 || ranked[i][0].level > ranked[best][0].level)) best = i;
		}
		if (best < 0) return order;
		order.push(ranked[best].shift()!.account);
	}
}

/**
 * How far through the map each running player is, 0 to 1, by their level out of the map's
 * levels. Servers that don't know the map's level count are left out.
 */
export function progressFractions(snapshots: RelayProgress[]): Map<SteamID3, number> {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
	const fractions = new Map<SteamID3, number>();
	for (const s of snapshots) {
		if (!(s.totalProgressLevels > 0)) continue;
		for (const p of s.players) {
			if (p.running) fractions.set(p.account, Math.min(p.level / s.totalProgressLevels, 1));
		}
	}
	return fractions;
}

/**
 * A mass-single race's players: finished players by position, then the running players by how
 * far through the map they are, per the game servers' progress, which updates more often than
 * positions do. Anyone left follows by position.
 */
export function massSingleOrder(board: LeaderboardEntry[], progress: RelayProgress[]): SteamID3[] {
	const byPosition = [...board].sort((a, b) => a.position - b.position);
	const ordered = byPosition.map((e) => e.steamId3);
	const finished = byPosition.filter((e) => e.status === 'finished').map((e) => e.steamId3);
	const running = progressOrder(progress).filter(
		(id) => ordered.includes(id) && !finished.includes(id)
	);
	const rest = ordered.filter((id) => !finished.includes(id) && !running.includes(id));
	return [...finished, ...running, ...rest];
}

export type LastSpectatorSelect = {
	players: [SteamID3 | null, SteamID3 | null];
	at: number; // epoch ms
	sent: boolean; // false when the socket wasn't open, so it was dropped
};

export class JFRelayWebSocket {
	private _ws: ProxyWebSocket | undefined;
	private _unsubscribeState: (() => void) | undefined;
	private _token = '';
	private _reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	private _reconnectDelayMs = 1000;
	private _wsState: number;
	// each game server's latest progress, by server code
	private _progress: Record<string, RelayProgress>;
	// the last players asked to be spectated, when, and whether it went out, for the controls
	private _lastSelect: LastSpectatorSelect | undefined;

	constructor() {
		this._ws = undefined;
		this._wsState = $state(WebSocket.CLOSED);
		this._progress = $state({});
		this._lastSelect = $state(undefined);
	}

	private onWsMessage(event: MessageEvent) {
		let data: RelayProgress | RelayProgressReset | { type?: unknown };
		try {
			data = JSON.parse(event.data);
		} catch {
			return;
		}

		if (data.type === 'relay_progress_reset') {
			this._progress = {};
		} else if (data.type === 'relay_progress') {
			const snapshot = data as RelayProgress;
			if (snapshot.players.length) this._progress[snapshot.server_code] = snapshot;
			else delete this._progress[snapshot.server_code];
		}
	}

	/**
	 * Detaches and closes the current socket. Its events are ignored from here on, so its close
	 * can't mark a newer socket as closed.
	 */
	private detach() {
		clearTimeout(this._reconnectTimer);
		this._reconnectTimer = undefined;
		this._unsubscribeState?.();
		this._unsubscribeState = undefined;
		const old = this._ws;
		this._ws = undefined;
		if (old && old.readyState !== WebSocket.CLOSED) {
			console.log('closing jf relay websocket...');
			old.close(1000);
		}
	}

	/** Closes the connection for good, without reconnecting. */
	close() {
		this.detach();
		this._wsState = WebSocket.CLOSED;
		this._progress = {};
	}

	connect(wsToken: string) {
		this._token = wsToken.trim();
		this._reconnectDelayMs = 1000;
		this.open();
	}

	private open() {
		this.detach();
		console.log('initializing jf relay websocket');

		// connect to websocket
		// the console set in the controls, like the ksn websocket
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
		const url = new URL(consoleBaseUrl());
		url.searchParams.set('token', this._token);
		url.searchParams.set('channel', 'progress');
		const ws = new ProxyWebSocket(url.toString());
		this._ws = ws;

		this._progress = {};
		ws.onmessage = (event) => {
			if (this._ws === ws) this.onWsMessage(event);
		};

		// broadcast welcome on connect
		ws.onopen = () => {
			if (this._ws !== ws) return;
			console.log('jf relay websocket connected');
			this._reconnectDelayMs = 1000;
			const msg: JFRelayWelcomeEvent = {
				type: 'overlay_connected',
				value: 'hello world'
			};
			this.send(msg);
		};

		ws.onclose = (event) => {
			console.log(`jf relay websocket closed: code ${event.code} ${event.reason}`.trim());
			// a replaced socket, or one closed on purpose
			if (this._ws !== ws) return;
			this._progress = {};
			// retry with backoff, up to 30s between attempts
			const delay = this._reconnectDelayMs;
			this._reconnectDelayMs = Math.min(delay * 2, 30_000);
			console.log(`jf relay reconnecting in ${delay / 1000}s`);
			this._reconnectTimer = setTimeout(() => {
				if (this._ws === ws) this.open();
			}, delay);
		};

		this._unsubscribeState = ws.state.subscribe((state) => {
			if (this._ws === ws) this._wsState = state;
		});
	}

	broadcastSelectedPlayers(steamId3s: Array<SteamID3 | undefined>) {
		const playerA = steamId3s[0] ?? null;
		const playerB = steamId3s[1] ?? null;
		console.log(`jf relay broadcasting player selections: [${playerA}, ${playerB}]`);
		const msg: JFRelaySpectatorSelectEvent = {
			type: 'spectator_select',
			value: { playerA: playerA, playerB: playerB }
		};
		const sent = this.send(msg);
		this._lastSelect = { players: [playerA, playerB], at: Date.now(), sent };
	}

	get lastSelect() {
		return this._lastSelect;
	}

	/** Sends a message when the socket is open, and says whether it did. */
	send(msg: JFRelayEvents): boolean {
		const msgString = JSON.stringify(msg);

		if (this._ws?.readyState === WebSocket.OPEN) {
			this._ws.send(msgString);
			return true;
		}
		console.warn('socket not open, dropping', msgString);
		return false;
	}

	addEventListener(
		type: keyof WebSocketEventMap,
		listener: (this: WebSocket, ev: Event | CloseEvent | MessageEvent<any>) => any,
		options?: boolean | AddEventListenerOptions
	) {
		this._ws?.addEventListener(type, listener, options);
	}

	// getters
	get wsState(): number {
		return this._wsState;
	}

	/** Every game server's latest progress snapshot. */
	get progress(): RelayProgress[] {
		return Object.values(this._progress);
	}
}
