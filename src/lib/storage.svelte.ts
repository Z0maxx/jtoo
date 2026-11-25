import { PersistentState } from '@friendofsvelte/state';
import {
	type Items,
	type Overlay,
	type Pool,
	type Settings,
	Player,
	type SteamID3,
	TFMap,
	type TempusID,
	type FundraisingState
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
	enableFundraisingSection: false,
	enableFundraisingDonations: true,
	enableFundraisingRtd: false,
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
	obsWsPw: '',
	fundraisingShowDonationSeconds: 5
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

export const defaultFundraisingState: FundraisingState = {
	eventUrl: 'https://events.doctorswithoutborders.org/campaigns/Jump-Fortress-DWB-event',
	lastDonationProcessedByDonationsId: '',
	lastDonationProcessedByMessagesId: '',
	lastDonationProcessedByRtdId: '',
	donations: [],
	displayedDonations: [],
	displayedDonationsWithMessages: [],
	stage: 0,
	animationStage: 0,
	sumGoal: 0,
	progressBar: {
		raised: 0,
		sumRaised: 0
	}
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

// OBS's live (program) scene as reported by the controls' obs-websocket connection, with when it
// was reported. the overlay prefers it to its browser source's own scene events, which can miss
// a switch (and can't be asked for the scene below the 'read user information' permission)
export const obsProgramScene = new PersistentState<{ name: string; at: number }>(
	'obsProgramScene',
	{ name: '', at: 0 },
	'localStorage'
);

export const fundraisingState = new PersistentState(
	'fundraisingState',
	defaultFundraisingState,
	'localStorage'
);

export function fullReset() {
	settings.current = defaultSettings;
	overlay.current = defaultOverlay;
	// items.current = defaultItems;
}
