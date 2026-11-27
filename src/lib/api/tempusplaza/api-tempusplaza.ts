import type { Player } from '$lib/types.svelte';
import { createRateLimitedApi } from '../rate-limited-api';

export namespace TempusPlaza {
	// through our own route, which passes on Tempus Plaza's 429s and Retry-After for the queue
	// to wait out. Tempus Plaza doesn't document a rate, so this paces like Tempus: 1 a second
	const fetchPlaza = createRateLimitedApi({
		baseUrl: '/api/tempusplaza',
		defaultTimeoutSeconds: 1,
		requestTimeoutSeconds: 15
	});

	export function getImageUrl(mapName: string, quality?: 'medium' | 'full') {
		return quality == 'medium'
			? `https://tempusplaza.com/map-backgrounds/medium/${mapName}.webp`
			: `https://tempusplaza.com/map-backgrounds/${mapName}.webp`;
	}

	export async function fetchPlayerRecords(player: Player) {
		const response = await fetchPlaza(`/players/${player.tempusID}/stats`);
		if (!response.ok) throw new Error(`Failed to fetch stats: ${response.status}`);
		let data: TempusPlaza.PlayerStats = await response.json();

		player.WRs = {
			soldier: data.soldier.worldRecords.map,
			demoman: data.demoman.worldRecords.map,
			overall: data.combined.worldRecords.map
		};
		player.TTs = {
			soldier: data.soldier.top10Records.map,
			demoman: data.demoman.top10Records.map,
			overall: data.combined.top10Records.map
		};

		return player;
	}

	interface Records {
		map: number;
		course: number;
		bonus: number;
		total: number;
	}
	// Player Stats
	// https://api.tempusplaza.com/players/{tempusId}/stats
	export interface PlayerStats {
		soldier: {
			worldRecords: Records;
			top10Records: Records;
			g1Records: Records;
			g2Records: Records;
			g3Records: Records;
			g4Records: Records;
			completion: Records;
		};
		demoman: {
			worldRecords: Records;
			top10Records: Records;
			g1Records: Records;
			g2Records: Records;
			g3Records: Records;
			g4Records: Records;
			completion: Records;
		};
		combined: {
			worldRecords: Records;
			top10Records: Records;
			g1Records: Records;
			g2Records: Records;
			g3Records: Records;
			g4Records: Records;
			completion: Records;
		};
	}
}
