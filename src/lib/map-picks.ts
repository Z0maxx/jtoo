import type { KSN } from '$lib/websockets/ksn/ws-ksn-types.svelte';
import { getMap } from '$lib/util';
import { settings } from '$lib/storage.svelte';

// a pick & ban session's series, shared by the map scene and the match scene's map picks

export type PickSession = NonNullable<KSN.PickBansSessionStateEvent['session']>;
export type Actor = 'A' | 'B';

// player A plays blue, player B red
export const teamText: Record<Actor, string> = { A: 'text-ctp-blue', B: 'text-ctp-red' };
export const teamBg: Record<Actor, string> = { A: 'bg-ctp-blue', B: 'bg-ctp-red' };
export const teamOutline: Record<Actor, string> = { A: 'outline-ctp-blue', B: 'outline-ctp-red' };

/** A map's name as the settings want it shown, or `fallback` for a map JTOO doesn't know. */
export function mapName(fileName: string, fallback?: string | null): string {
	const map = getMap(fileName);
	if (!map.fileName) return fallback || fileName;
	return settings.current.useShortMapNames ? map.shortName : map.fileName;
}

/** The map left over once every step is done, played last when the picks don't fill the series. */
export function deciderId(session: PickSession): string | undefined {
	const picks = session.history.filter((h) => h.action === 'pick').length;
	if (picks >= session.config.seriesLength) return undefined;
	const done = new Set(session.history.map((h) => h.mapId));
	const left = session.maps.filter((m) => !done.has(m.id));
	return left.length === 1 ? left[0].id : undefined;
}

/** The series in play order: each pick with who picked it, then the decider, picked by nobody. */
export function seriesOf(session: PickSession): { mapId: string; actor?: Actor }[] {
	const played: { mapId: string; actor?: Actor }[] = session.history
		.filter((h) => h.action === 'pick')
		// the console adds the leftover map as an 'elimination' pick when the steps run out:
		// that's the decider, nobody's pick
		.map((h) => ({ mapId: h.mapId, actor: h.resolvedBy === 'elimination' ? undefined : h.actor }));
	const decider = deciderId(session);
	if (decider) played.push({ mapId: decider });
	return played;
}

/**
 * Whether the match scene shows the series' map picks: a live session (not cancelled) with more
 * than one of its maps in the series. Shared so the bottom area can make room for them.
 */
export function showsMapPicks(session: PickSession | null | undefined): boolean {
	if (!session || session.status === 'cancelled') return false;
	const inSeries = seriesOf(session).filter(({ mapId }) =>
		session.maps.some((m) => m.id === mapId)
	);
	return inSeries.length > 1;
}
