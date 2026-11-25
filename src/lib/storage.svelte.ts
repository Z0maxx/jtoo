import { PersistentState } from '@friendofsvelte/state';
import {
	type Items,
	type Overlay,
	type Pool,
	type Settings,
	Player,
	type SteamID3,
	TFMap,
	type TempusID
} from './types.svelte';
import { addPlayersFromSteamID3, getMap, getPlayer } from './util';
import { Tempus2 } from './api/tempus2/api-tempus2';
import { Steam } from './api/steam/api-steam';
import { TempusPlaza } from './api/tempusplaza/api-tempusplaza';

export const defaultStages: Array<string> = [
	'',
	'Round 1',
	'Round 2',
	'Quarterfinals',
	'Semifinals',
	'Finals',
	'Grand Finals',
	"Loser's Quarters",
	"Loser's Semis",
	"Loser's Finals"
];

export const defaultSettings: Settings = {
	font: 'font-geist',
	monoFont: 'font-azeret-mono',
	hue: 0,
	saturation: 100,
	enableMovingBG: true,
	enablePRs: true,
	enableAvatars: true,
	enableTags: false,
	enableFlags: false,
	enableGradient: true,
	enableTeamColors: true,
	enablePOVGuide: false,
	useShortMapNames: true,
	ksnWebSocketToken: '',
	consoleBaseUrl: 'https://console.jumpfortress.tf',
	followConsoleStageMap: true,
	followRacePlayers: true,
	selectDuelPlayers: true,
	useDummyData: false,
	tfClass: 'soldier',
	scheduleDay: 0,
	jfRelayWebSocketToken: '',
	logWsMessages: false,
	overlayScene: 'DualPovMatchScene',
	idleObsScene: 'Idle',
	idleOverlayScene: '',
	obsWsIp: '',
	obsWsPort: undefined,
	obsWsPw: ''
};

export const defaultOverlay: Overlay = {
	bestOf: 3,
	players: [undefined, undefined, undefined, undefined],
	map: '',
	stage: '',
	tournament: '',
	bracket: ''
};

export const defaultItems: Items = {
	players: [new Player()],
	maps: [new TFMap()],
	stages: defaultStages,
	brackets: []
};

// overlay settings
export const settings = new PersistentState('settings', defaultSettings, 'localStorage');

// overlay state
export const overlay = new PersistentState('overlay', defaultOverlay);

// overlay items
export const items = new PersistentState('items', defaultItems);

// the event's players and maps, imported from console pools
export const pool = new PersistentState<Pool>('pool', { players: [], maps: [] });

// ws messages
export const wsMessages: PersistentState<any[]> = new PersistentState('wsMessages', []);

export function fullReset() {
	settings.current = defaultSettings;
	overlay.current = defaultOverlay;
	// items.current = defaultItems;
}
