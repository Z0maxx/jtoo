import { Steam } from '$lib/api/steam/api-steam';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body: { steamids?: unknown } = await request.json();
	if (!('steamids' in body)) {
		return json({}, { status: 400 });
	}

	let idParam: string;

	if (typeof body.steamids == 'string') {
		idParam = body.steamids as string;
	} else if (Array.isArray(body.steamids)) {
		idParam = body.steamids.join(',');
	} else {
		return json({}, { status: 400 });
	}

	// the url carries the api key, so it's never logged
	const endpoint = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${env.STEAM_API_KEY}&steamids=${idParam}`;
	const response = await fetch(endpoint);
	const data: Steam.GetPlayerSummaries = await response.json();

	// the client reads a null body as "no players found"
	if (data.response.players.length == 0) {
		return json(null);
	}

	return json({ response: data.response.players }, { status: 201 });
};
