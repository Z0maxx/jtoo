import type { PickSession } from '$lib/map-picks';
import { getJson, type ConsoleMapPool } from '$lib/console-pools.svelte';
import { lastPickSession } from '$lib/storage.svelte';
import { getPlayer } from '$lib/util';
import type { SteamID3 } from '$lib/types.svelte';

// Bringing back a pick & ban session the overlay lost. The console doesn't send the current
// session when the overlay connects, so after a reconnect or an OBS refresh the map picks stay
// blank until the next step. Two places still have it: the copy the overlay keeps of the last
// session it received, and the console's list of completed sessions.

/** A completed session as the console's GET /api/pickbans/sessions lists it. */
type CompletedSession = {
	id: string;
	playerA: CompletedPlayer;
	playerB: CompletedPlayer;
	mapPoolId: string;
	mapPoolName: string;
	roundName: string | null;
	seriesLength: 3 | 5;
	turnTimeLimitSeconds: number;
	createdAt: string;
	startedAt: string;
	completedAt: string;
	updatedAt: string;
	history: (PickSession['history'][number] & { mapName: string; mapDisplayName: string | null })[];
};
type CompletedPlayer = { id: string; displayName: string; steamAccountId: string };

/**
 * The newer of the overlay's own copy and the console's latest completed session, or null when
 * neither has one. A console that can't be reached falls back to the overlay's copy.
 */
export async function lastSession(): Promise<PickSession | null> {
	const local = lastPickSession.current;
	const fromConsole = await latestCompletedSession().catch((e) => {
		console.warn('could not fetch completed pick & ban sessions from the console', e);
		return null;
	});
	if (!local || !fromConsole) return local ?? fromConsole;
	return Date.parse(fromConsole.updatedAt) > Date.parse(local.updatedAt) ? fromConsole : local;
}

async function latestCompletedSession(): Promise<PickSession | null> {
	const { sessions } = await getJson<{ sessions: CompletedSession[] }>('/api/pickbans/sessions');
	// newest first
	const latest = sessions[0];
	if (!latest) return null;
	// the pool's maps, for any the history doesn't name (e.g. a decider nobody picked); a pool
	// that's gone since still leaves the history's
	const pools = await getJson<{ mapPools: ConsoleMapPool[] }>('/api/map-pools').catch(() => ({
		mapPools: [] as ConsoleMapPool[]
	}));
	return toPickSession(
		latest,
		pools.mapPools.find((p) => p.id === latest.mapPoolId)
	);
}

/** A completed session in the shape the console's websocket sends, so the scenes can show it. */
function toPickSession(s: CompletedSession, mapPool: ConsoleMapPool | undefined): PickSession {
	const maps = [...(mapPool?.maps ?? [])]
		.sort((a, b) => a.position - b.position)
		.map(({ id, name, displayName }) => ({ id, name, displayName }));
	for (const h of s.history) {
		if (!maps.some((m) => m.id === h.mapId)) {
			maps.push({ id: h.mapId, name: h.mapName, displayName: h.mapDisplayName });
		}
	}
	const history = s.history.map(
		({ turnId, stepIndex, actor, action, mapId, resolvedBy, resolvedAt }) => ({
			turnId,
			stepIndex,
			actor,
			action,
			mapId,
			resolvedBy,
			resolvedAt
		})
	);
	return {
		id: s.id,
		revision: 0,
		status: 'completed',
		createdAt: s.createdAt,
		startedAt: s.startedAt,
		completedAt: s.completedAt,
		updatedAt: s.updatedAt,
		playerA: toPlayer(s.playerA),
		playerB: toPlayer(s.playerB),
		mapPoolId: s.mapPoolId,
		mapPoolName: s.mapPoolName,
		roundName: s.roundName,
		maps,
		// the record keeps only the steps that were played, which is every step of a finished veto
		steps: history.map(({ stepIndex, actor, action }) => ({ index: stepIndex, actor, action })),
		currentStepIndex: history.length,
		config: { seriesLength: s.seriesLength, turnTimeLimitSeconds: s.turnTimeLimitSeconds },
		history
	};
}

/** The record has only the player's name and Steam account id; the rest comes from JTOO's players. */
function toPlayer(p: CompletedPlayer): PickSession['playerA'] {
	const accountId = Number(p.steamAccountId);
	const known = getPlayer(accountId as SteamID3);
	return {
		id: p.id,
		displayName: p.displayName,
		personaName: p.displayName,
		steamId64: (76561197960265728n + BigInt(accountId)).toString(),
		steamAccountId: p.steamAccountId,
		steamId3: `[U:1:${accountId}]`,
		profileUrl: '',
		avatarUrl: known?.avatarURL ?? '',
		countryCode: null,
		countryName: null,
		source: 'manual',
		createdAt: '',
		updatedAt: ''
	};
}
