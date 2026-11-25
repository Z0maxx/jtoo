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
