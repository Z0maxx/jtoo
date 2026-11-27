import { connectGameServer, queueRtdEffect } from '$lib/server/rtd';
import { rtdEffects } from '$lib/websockets/jf-rtd/jf-rtd.svelte';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, url }) => {
	const token = url.searchParams.get('token');
	if (!token) {
		return new Response(`token is not included`, { status: 401 });
	}

	const effect = params.effect!;
	if (!rtdEffects.includes(effect)) {
		return new Response(`'${effect}' is not an rtd effect`, { status: 400 });
	}

	if (!(await connectGameServer(token))) {
		return new Response('invalid token', { status: 401 });
	}

	queueRtdEffect(effect);
	return new Response(null, { status: 204 });
};
