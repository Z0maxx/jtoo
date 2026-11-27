// claude
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { id } = params;

	// Only allow numeric IDs so this can't be used to hit arbitrary upstream paths
	if (!/^\d+$/.test(id)) {
		throw error(400, 'Invalid player ID');
	}

	const res = await fetch(`https://api.tempusplaza.com/players/${id}/stats`);

	// passed on with its Retry-After, so the client's rate-limited queue knows how long to wait
	if (res.status === 429) {
		const retryAfter = res.headers.get('Retry-After');
		return new Response('Rate limited by Tempus Plaza', {
			status: 429,
			headers: retryAfter ? { 'Retry-After': retryAfter } : {}
		});
	}

	if (!res.ok) {
		throw error(res.status, 'Upstream request failed');
	}

	const data: unknown = await res.json();

	return json(data, {
		headers: { 'Cache-Control': 'public, max-age=300' }
	});
};
