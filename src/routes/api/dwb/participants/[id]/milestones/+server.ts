import { dwbParticipantUrl, fresh, uncached } from '$lib/server/dwb';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	return uncached(await fetch(fresh(dwbParticipantUrl(params.id, '/milestones'))));
};
