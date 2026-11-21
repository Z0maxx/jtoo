import { KSN } from './ws-ksn-types.svelte';
import { ProxyWebSocket } from '../../ProxyWebSocket';
import { consoleBaseUrl } from '$lib/util';
import { TFMap } from '$lib/types.svelte';
import { settings, wsMessages } from '$lib/storage.svelte';

type PickedMaps = Array<{ mapID: string; steamID3: string }>;

// The console's raw websocket, now only used for pick & bans. Race and tournament state
// comes from the console's live feeds (see websockets/console/console-live.svelte.ts).
export class KSNWebSocket {
	private _ws: ProxyWebSocket | undefined;
	private _wsState: number;
	private _channel: BroadcastChannel;
	private _messages: KSN.Messages;
	private _pickedMaps: PickedMaps;

	/** Called with the token on every connect, so the page can open the console feeds too. */
	onconnect: ((wsToken: string) => void) | undefined;

	constructor(broadcastChannel: string) {
		this._ws = undefined;
		this._wsState = $state(WebSocket.CLOSED);
		this._channel = new BroadcastChannel(broadcastChannel);
		// $state so the scenes update as picks and bans come in
		this._messages = $state(KSN.defaultMessages());
		this._pickedMaps = $state([]) as PickedMaps;

		this._channel.postMessage({
			type: 'welcome',
			value: `KSN WebSocket Receiver listening to channel: ${this._channel.name}`
		});
		this._channel.onmessage = (event) => this.onBcMessage(event);
	}

	private onBcMessage(event: MessageEvent) {
		const data: KSNBCMessageType = event.data;

		switch (data.type) {
			case 'connect':
				this.connect(data.value);
				break;
			case 'clearPicksAndBans':
				this.clearPicksAndBans();
				break;
			case 'request-wsState':
				this._channel.postMessage({ type: 'wsState', value: this.wsState });
				break;
			default:
				break;
		}
	}
	private onWsMessage(event: MessageEvent) {
		const data: KSN.MessageTypes = JSON.parse(event.data);

		if (settings.current.logWsMessages) this.logWsMessage(data);

		switch (data.type) {
			case 'pickbans_session_state':
				this._messages.mapPicks = data as KSN.PickBansSessionStateEvent;
				this.processMapPick();
				break;
			default:
				return;
		}
	}

	connect(wsToken: string) {
		this.onconnect?.(wsToken);

		if (this._ws && this._ws.readyState == ProxyWebSocket.OPEN) {
			console.log('closing web socket connection...');
			this._ws.close();
		}

		console.log('initializing ksn websocket');

		// clear messages
		this._messages = KSN.defaultMessages();

		// connect to websocket
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local, not reactive state
		const url = new URL(consoleBaseUrl());
		url.searchParams.set('token', wsToken);
		this._ws = new ProxyWebSocket(url.toString());

		// handle websocket messages
		this._ws.onmessage = (event) => {
			this.onWsMessage(event);
		};

		// broadcast state
		this._ws.state?.subscribe((state) => {
			this._wsState = state;
			this._channel.postMessage({ type: 'wsState', value: state });
		});
	}

	clearPicksAndBans() {
		this._messages.mapPicks = { type: 'pickbans_session_state', session: null };
		this._pickedMaps = [];
	}

	logWsMessage(data: KSN.MessageTypes) {
		const entry = {
			timestamp: new Date().toISOString(),
			data: data
		};

		wsMessages.current.push(entry);
	}

	// map picks
	// rebuilt from the session's history on every update, so no step is ever skipped
	processMapPick() {
		if (!this._messages.mapPicks.session) {
			return;
		}

		this._pickedMaps = [];
		for (const turn of this._messages.mapPicks.session.history) {
			if (turn.action == 'pick') {
				const actor = this._messages.mapPicks.session[`player${turn.actor}`].steamId3;
				this._pickedMaps = [...this._pickedMaps, { mapID: turn.mapId, steamID3: actor }];
			}
		}

		this._messages.mapPicksPrevious = { ...this._messages.mapPicks };
	}
	/**
	 * The pick & ban id of a map file name, e.g. jump-ambition for jump_ambition_final. The
	 * session lists its maps with both; the file name with its first _ as - is a fallback.
	 */
	mapIdFor(fileName: string): string {
		const option = this._messages.mapPicks.session?.maps.find((m) => m.name == fileName);
		return option?.id ?? TFMap.fileNameToTfId(fileName);
	}

	// getters
	get pickedMaps(): PickedMaps {
		return this._pickedMaps;
	}
	get messages(): KSN.Messages {
		return this._messages;
	}
	get wsState(): number {
		return this._wsState;
	}
}

export class KSNWebSocketController {
	private _channel: BroadcastChannel;
	private _wsState: number;

	constructor(broadcastChannel: string) {
		this._channel = new BroadcastChannel(broadcastChannel);
		this._wsState = $state(WebSocket.CLOSED);

		this._channel.postMessage({
			type: 'welcome',
			value: `KSN WebSocket Controller broadcasting to channel: ${this._channel.name}`
		});
		this._channel.postMessage({
			type: 'request-wsState'
		});

		this._channel.onmessage = (event) => this.onBcMessage(event);
	}
	private onBcMessage(event: MessageEvent) {
		const data: KSNBCMessageType = event.data;

		switch (data.type) {
			case 'wsState':
				this._wsState = data.value;
				break;
			default:
				break;
		}
	}

	connect(wsToken: string) {
		this._channel.postMessage({
			type: 'connect',
			value: wsToken
		});
	}
	clearPicksAndBans() {
		this._channel.postMessage({
			type: 'clearPicksAndBans'
		});
	}

	// getters
	get wsState() {
		return this._wsState;
	}
}

interface BaseKSNBCMessage {
	type: 'welcome' | 'connect' | 'clearPicksAndBans' | 'wsState' | 'request-wsState';
}
interface KSNBCWelcomeMessage extends BaseKSNBCMessage {
	type: 'welcome';
	value: string;
}
interface KSNBCConnectMessage extends BaseKSNBCMessage {
	type: 'connect';
	value: string;
}
interface KSNBCPickBanMessage extends BaseKSNBCMessage {
	type: 'clearPicksAndBans';
}
interface KSNBCWSStateMessage extends BaseKSNBCMessage {
	type: 'wsState';
	value: number;
}
interface KSNBCRequestWSStateMessage extends BaseKSNBCMessage {
	type: 'request-wsState';
}

export type KSNBCMessageType =
	| KSNBCWelcomeMessage
	| KSNBCConnectMessage
	| KSNBCPickBanMessage
	| KSNBCWSStateMessage
	| KSNBCRequestWSStateMessage;
