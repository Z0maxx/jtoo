import { dwbParticipantUrl, fresh, uncached } from '$lib/server/dwb';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	return uncached(
		await fetch(
			fresh(
				`${dwbParticipantUrl(params.id, '/donations')}?${url.searchParams.toString().replaceAll('+', '%20')}`
			)
		)
	);
};
