import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const { id } = params;
	return await fetch(
		`${env.DWB_API_URL}/participants/${id}/donations?${url.searchParams.toString().replaceAll('+', '%20')}`
	);
};
