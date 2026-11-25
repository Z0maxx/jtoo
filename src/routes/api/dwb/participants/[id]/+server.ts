import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
	const { id } = params;
	return await fetch(`${env.DWB_API_URL}/participants/${id}`);
};
