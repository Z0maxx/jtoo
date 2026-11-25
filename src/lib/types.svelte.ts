import { v4 as uuidv4 } from 'uuid';
import { type Results } from './Bracket.svelte';
import type { Tempus2 } from './api/tempus2/api-tempus2';

// MARK: Types
export type Seconds = number;
export type Centiseconds = number;
export type TempusID = number;
export const TFClasses = ['demoman', 'soldier', 'overall'] as const;
export type TFClass = (typeof TFClasses)[number];

export type Rank = { points: number; rank: number; title: string | null };

export const Divisions = ['wood', 'steel', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
export type Division = (typeof Divisions)[number];

export type SteamID3 = number;
export type MapFileName = string;

export class Player {
	name: string = '';
	division: Division | null = null;
	score: number = 0;
	tempusID: number | undefined = undefined;
	steamID3: number = 0;
	steamID: string = '';
	avatarURL: string = '';
	tag: string = '';
	flag: string = '';
	pr: string = ''; // only used for manual PRs
	rank: Record<TFClass, Rank> | undefined = undefined;
	TTs: Record<TFClass, number> | undefined = undefined;
	WRs: Record<TFClass, number> | undefined = undefined;
	bestRun: string = '';
	note: string = '';
	favouriteMap: string = '';
}

export type MapRun = {
	tempusID: number;
	rank: number;
	duration: Seconds;
};

export class TFMap {
	fileName: MapFileName = '';
	shortName: string = '';
	mapZoneId: number = 0;
	intendedClass: Record<Exclude<TFClass, 'overall'>, boolean> = { soldier: false, demoman: false };
	tier: Record<Exclude<TFClass, 'overall'>, number> = { soldier: 0, demoman: 0 };
	authors: Tempus2.Author[] = [];
	worldRecordInfo: Record<Exclude<TFClass, 'overall'>, Tempus2.Run2 | undefined> = {
		soldier: undefined,
		demoman: undefined
	};
	runs: Omit<Record<TFClass, MapRun[]>, 'overall'> = { soldier: [], demoman: [] };

	imageURL?: string = '';

	static fileNameToShortName(fileName: string): string {
		if (fileName == 'jump_') return fileName;

		const tmp = fileName.match(/(?<=_)[^_]+/); // match name after first '_' and before any subsequent '_', eg: 'beef' from 'jump_beef' or 'jump_beef_final'
		return tmp ? tmp[0].trim() : '';
	}

	static fileNameToTfId(fileName: string): string {
		return fileName.replace('_', '-');
	}
}

export const nullPlayer: Player = Object.freeze(new Player());

export const BracketOptions = ['whole', 'upper', 'lower'] as const;
export type BracketOption = (typeof BracketOptions)[number];

// a double elimination bracket, made on its own from JTOO's players
export const BracketSizes = [4, 8, 10] as const;
export type BracketSize = (typeof BracketSizes)[number];

export type SavedBracket = {
	id: string;
	name: string;
	size: BracketSize;
	players: SteamID3[]; // seeding order: seed 1 first
	results: Results;
};

export function newBracket(): SavedBracket {
	return { id: uuidv4(), name: '', size: 8, players: [], results: {} };
}

// MARK: Settings
export const Fonts = [
	'font-inter',
	'font-montserrat',
	'font-roboto',
	'font-space-grotesk',
	'font-geist',
	'font-lexend-deca',
	'font-manrope',
	'font-nunito-sans',
	'font-outfit'
] as const;
export type Font = (typeof Fonts)[number];

export const MonoFonts = [
	'font-dm-mono',
	'font-anonymous-pro',
	'font-ubuntu-mono',
	'font-azeret-mono',
	'font-chivo-mono',
	'font-spline-sans-mono'
] as const;
export type MonoFont = (typeof MonoFonts)[number];

export const OverlayScenes = [
	'',
	'DualPovMatchScene',
	'SinglePovMatchScene',
	'TournamentInfoScene',
	'ScheduleScene',
	'DonationsScene',
	'MapScene',
	'LeaderboardScene',
	'BracketScene',
	'PlayerCardScene',
	'PlayerListScene',
	'ThanksScene'
] as const;
// these weren't updated with the last big changes due to time constraints and relevance to the event format
export const BrokenOverlayScenes = [
	'TournamentInfoScene',
	// 'PlayerCardScene', // currently unable to fetch tempus data via only steam id, so this scene looks broken
	'ThanksScene'
];
export type OverlayScene = (typeof OverlayScenes)[number];
// match scenes are built around the players' POVs, so they make no sense over the Idle scene
export const MatchOverlayScenes = ['DualPovMatchScene', 'SinglePovMatchScene'] as const;
export type IdleOverlayScene = Exclude<OverlayScene, (typeof MatchOverlayScenes)[number]>;
export const IdleOverlayScenes = OverlayScenes.filter(
	(s): s is IdleOverlayScene =>
		!(MatchOverlayScenes as readonly string[]).includes(s) && !BrokenOverlayScenes.includes(s)
);

export type Settings = {
	font: Font;
	monoFont: MonoFont;
	hue: number;
	saturation: number;
	enableMovingBG: boolean;
	enablePRs: boolean;
	enableAvatars: boolean;
	enableTags: boolean;
	enableFlags: boolean;
	enableGradient: boolean;
	enableTeamColors: boolean;
	enablePOVGuide: boolean;
	enableFundraisingSection: boolean;
	enableFundraisingDonations: boolean;
	enableFundraisingRtd: boolean;
	useShortMapNames: boolean;
	overlayScene: OverlayScene;
	idleObsScene: string; // name of the broadcaster's OBS Idle scene
	idleOverlayScene: IdleOverlayScene; // shown, without backgrounds, while OBS is on the Idle scene
	ksnWebSocketToken: string;
	consoleBaseUrl: string; // console host for the live feeds and the raw websocket
	followConsoleStageMap: boolean; // set the stage and map labels from the console's race
	followRacePlayers: boolean; // player lists show the race's players in leaderboard order
	selectDuelPlayers: boolean; // a duel race selects its racers as player A and B
	useDummyData: boolean; // show made-up race and tournament data instead of the console's
	tfClass: Exclude<TFClass, 'overall'>; // the class shown on player cards and lists
	scheduleDay: number; // index into scheduleDays, the sheet tab the schedule scene reads
	jfRelayWebSocketToken: string;
	logWsMessages: boolean;
	obsWsIp: string;
	obsWsPort: number | undefined;
	obsWsPw: string;
	fundraisingShowDonationSeconds: number;
};

export type Overlay = {
	bestOf: number;
	players: Array<SteamID3 | undefined>;
	map: MapFileName;
	stage: string;
	tournament: string; // console tournament id the leaderboard shows; '' follows the race
	bracket: string; // id of the bracket the bracket scene shows
	// console time of the last 'clear timers'; runs and race windows that started earlier are hidden
	timersClearedAt?: number;
	// time of the controls' last schedule refresh; the overlay re-fetches the sheet when it changes
	scheduleRefreshedAt?: number;
};

// the event's players and maps, imported from a console player pool and map pool
export type Pool = {
	players: SteamID3[];
	maps: MapFileName[];
	playerPoolName?: string;
	mapPoolName?: string;
};

export type Items = {
	players: Player[];
	maps: TFMap[];
	stages: string[];
	brackets: SavedBracket[];
};

export type Subscriber<T> = {
	id: string;
	handler: (item: T) => void;
};

export type DonationsOverview = {
	goal: number;
	raised: number;
	donationCount: number;
};

export type Donation = {
	id: string;
	name: string;
	amount: number;
	message?: string;
	avatarUrl?: string;
	createdAt: string;
};

export type DonationMilestone = {
	goal: number;
	description: string;
	isActive: boolean;
	isComplete: boolean;
};

export type FundraisingState = {
	eventUrl: string;
	lastDonationProcessedByDonationsId: string;
	lastDonationProcessedByMessagesId: string;
	lastDonationProcessedByRtdId: string;
	donations: Donation[];
	displayedDonations: Donation[];
	displayedDonationsWithMessages: Donation[];
	stage: number;
	animationStage: number;
	sumGoal: number;
	progressBar: {
		raised: number;
		sumRaised: number;
	};
};
