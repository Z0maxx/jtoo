import { consoleBaseUrl } from './util';

export type ConsoleTournament = {
	id: string;
	name: string;
	kind: 'mass' | 'duel';
	/** The tournament's console map pool and player pool, null when it has none set. */
	mapPoolId: string | null;
	playerPoolId: string | null;
};

export type ConsoleTournamentList = {
	tournaments: ConsoleTournament[];
	activeTournamentId: string | null;
};

/** The console's tournaments. Listing them takes the OBS token. */
export async function fetchConsoleTournaments(token: string): Promise<ConsoleTournamentList> {
	const url = new URL('/api/tournaments', consoleBaseUrl() + '/');
	url.searchParams.set('token', token.trim());

	const response = await fetch(url);
	if (!response.ok) throw new Error(`could not list tournaments: ${response.status}`);

	const data: { tournaments?: ConsoleTournament[]; activeTournamentId?: string | null } =
		await response.json();
	return {
		tournaments: (data.tournaments ?? []).map((t) => ({
			id: t.id,
			name: t.name,
			kind: t.kind,
			mapPoolId: t.mapPoolId ?? null,
			playerPoolId: t.playerPoolId ?? null
		})),
		activeTournamentId: data.activeTournamentId ?? null
	};
}
