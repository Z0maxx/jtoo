import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

/**
 * The upstream DWB url for a participant, plus an optional sub path. The id comes from the
 * request, so it's limited to a plain slug: anything else (eg: `..`) could reach other paths
 * on the DWB api.
 */
export function dwbParticipantUrl(id: string, subPath = ''): string {
	if (!/^[\w-]+$/.test(id)) error(400, 'invalid participant id');
	return `${env.DWB_API_URL}/participants/${id}${subPath}`;
}

/**
 * A DWB response passed on to the overlay, uncached. DWB marks its responses cacheable for 4
 * hours, which kept browsers (OBS's included) showing old donations; only what the client reads
 * (the body, its type, the status and the ETag) is passed on.
 */
export function uncached(resp: Response): Response {
	const headers = new Headers({ 'Cache-Control': 'no-store' });
	for (const name of ['Content-Type', 'ETag']) {
		const value = resp.headers.get(name);
		if (value) headers.set(name, value);
	}
	return new Response(resp.body, { status: resp.status, headers });
}
