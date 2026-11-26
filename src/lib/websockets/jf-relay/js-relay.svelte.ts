import { ProxyWebSocket } from '$lib/ProxyWebSocket';
import { consoleBaseUrl } from '$lib/util';
import type { SteamID3 } from '$lib/types.svelte';

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

export class JFRelayWebSocket {
	private _ws: ProxyWebSocket | undefined;
	private _wsState: number;
	// each game server's latest progress, by server code
	private _progress: Record<string, RelayProgress>;

	constructor() {
		this._ws = undefined;
		this._wsState = $state(WebSocket.CLOSED);
		this._progress = $state({});
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

	connect(wsToken: string) {
		if (this._ws && this._ws.readyState == ProxyWebSocket.OPEN) {
			console.log('closing web socket connection...');
			this._ws.close();
		}

		console.log('initializing jf relay websocket');

		// connect to websocket
		// the console set in the controls, like the ksn websocket
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
		const url = new URL(consoleBaseUrl());
		url.searchParams.set('token', wsToken);
		url.searchParams.set('channel', 'progress');
		this._ws = new ProxyWebSocket(url.toString());

		this._progress = {};
		this._ws.onmessage = (event) => this.onWsMessage(event);

		// broadcast welcome on connect
		this._ws.onopen = () => {
			console.log('jf relay websocket connected');
			const msg: JFRelayWelcomeEvent = {
				type: 'overlay_connected',
				value: 'hello world'
			};
			this.send(msg);
		};

		this._ws.onclose = () => {
			console.log('jf relay websocket closing');
		};

		this._ws.state?.subscribe((state) => {
			console.log(`wsState: ${state}`);
			this._wsState = state;
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
		this.send(msg);
	}

	send(msg: JFRelayEvents) {
		const msgString = JSON.stringify(msg);

		if (this._ws?.readyState === WebSocket.OPEN) {
			this._ws.send(msgString);
		} else {
			console.warn('socket not open, dropping', msgString);
		}
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
