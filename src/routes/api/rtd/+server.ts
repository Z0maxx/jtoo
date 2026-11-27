import { connectGameServer } from '$lib/server/rtd';
import type { RequestHandler } from '@sveltejs/kit';

// connects to the game server with the token, so the controls can show whether RTD will work
// before a donation needs it
export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		return new Response(`token is not included`, { status: 401 });
	}

	if (!(await connectGameServer(token))) {
		return new Response('invalid token', { status: 401 });
	}

	return new Response(null, { status: 204 });
};
