import type { Seconds } from '$lib/types.svelte';

// kingstripes server network
export namespace KSN {
	// MARK: Picks and Bans
	type SeriesLength = 3 | 5;
	type PickBansActor = 'A' | 'B';
	type PickBansAction = 'pick' | 'ban';
	type PickBansSessionStatus = 'running' | 'completed' | 'cancelled';
	type PickBansResolutionSource = 'web' | 'in-game' | 'timeout-random' | 'elimination';

	interface MapOption {
		id: string;
		name: string;
		displayName: string | null;
	}

	interface PickBansSessionConfig {
		turnTimeLimitSeconds: Seconds;
		seriesLength: SeriesLength;
	}

	interface StepDefinition {
		index: number;
		actor: PickBansActor;
		action: PickBansAction;
	}

	interface ActiveTurn {
		turnId: string;
		stepIndex: number;
		actor: PickBansActor;
		action: PickBansAction;
		startedAt: string;
		expiresAt: string;
		acceptanceClosesAt: string;
		remainingMapIds: string[];
	}

	interface StepResult {
		turnId: string;
		stepIndex: number;
		actor: PickBansActor;
		action: PickBansAction;
		mapId: string;
		resolvedBy: PickBansResolutionSource;
		resolvedAt: string;
	}

	interface PlayerRecord {
		id: string;
		displayName: string;
		personaName: string;
		steamId64: string;
		steamAccountId: string;
		steamId3: string;
		profileUrl: string;
		avatarUrl: string;
		countryCode: string | null;
		countryName: string | null;
		source: 'steam-import' | 'manual';
		createdAt: string;
		updatedAt: string;
	}

	interface PickBansSessionState {
		id: string;
		revision: number;
		status: PickBansSessionStatus;
		createdAt: string;
		startedAt?: string;
		completedAt?: string;
		updatedAt: string;
		playerA: PlayerRecord;
		playerB: PlayerRecord;
		mapPoolId: string;
		mapPoolName: string;
		roundName?: string | null; // the round the console set for the series, e.g. "Grand Final"
		maps: MapOption[];
		steps: StepDefinition[];
		currentStepIndex: number;
		config: PickBansSessionConfig;
		currentTurn?: ActiveTurn;
		history: StepResult[];
	}

	export interface PickBansSessionStateEvent {
		type: 'pickbans_session_state';
		session: PickBansSessionState | null; // null when a session is cancelled
	}

	interface WelcomeEvent {
		type: 'welcome';
		message: string; // "Connected to WebSocket server"
		timestamp: number; // Unix timestamp
	}
	// MARK: Messages
	// Race and tournament events (timer_*, competition_session_*, mass_*) are no longer handled
	// here: the console publishes the race state over its live feeds instead.

	export type MessageTypes = PickBansSessionStateEvent | WelcomeEvent | { type: string };

	export type Messages = {
		mapPicks: PickBansSessionStateEvent;
		mapPicksPrevious: PickBansSessionStateEvent;
	};

	export function defaultMessages(): Messages {
		return {
			mapPicks: { type: 'pickbans_session_state', session: null },
			mapPicksPrevious: { type: 'pickbans_session_state', session: null }
		};
	}
}
