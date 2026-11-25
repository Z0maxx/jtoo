import { env } from '$env/dynamic/private';
import type { RequestHandler } from '@sveltejs/kit';
import openai from 'openai';

const openaiClient = new openai({ apiKey: env.OPENAI_API_KEY });

export const POST: RequestHandler = async (request) => {
	try {
		const body = (await request.request.json()) as { message?: string };
		if (!body.message) {
			return new Response('no message', { status: 400 });
		}

		const resp = await openaiClient.moderations.create({
			input: body.message,
			model: 'omni-moderation-2024-09-26'
		});

		const isAcceptable = !Object.entries(resp.results[0].categories).some(
			([_, flagged]) => flagged
		);
		return new Response(JSON.stringify({ isAcceptable }), { status: 200 });
	} catch (e) {
		// the error stays in the server log: it can carry details of the openai request
		console.error('message moderation failed', e);
		return new Response('moderation failed', { status: 500 });
	}
};
