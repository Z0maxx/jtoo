import { dwbParticipantUrl } from '$lib/server/dwb';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	return await fetch(
		`${dwbParticipantUrl(params.id, '/donations')}?${url.searchParams.toString().replaceAll('+', '%20')}`
	);
};
