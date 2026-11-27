import { dwbParticipantUrl, uncached } from '$lib/server/dwb';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	return uncached(await fetch(dwbParticipantUrl(params.id)));
};
