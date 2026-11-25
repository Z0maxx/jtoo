import { dwbParticipantUrl } from '$lib/server/dwb';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	return await fetch(dwbParticipantUrl(params.id, '/milestones'));
};
