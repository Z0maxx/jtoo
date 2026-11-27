import { env } from '$env/dynamic/private';
import type { Donation } from '$lib/types.svelte';
import type { RequestHandler } from '@sveltejs/kit';
import openai from 'openai';

// created on first request: the key isn't available at build time, when sveltekit imports this module
let openaiClient: openai | undefined;

export const POST: RequestHandler = async (request) => {
	try {
		const { donation } = (await request.request.json()) as { donation?: Donation };
		if (!donation) {
			return new Response('no donation', { status: 400 });
		}

		await moderateDonation(donation);
		return new Response(JSON.stringify({ moderatedDonation: donation }), { status: 200 });
	} catch (e) {
		// the error stays in the server log: it can carry details of the openai request
		console.error('donation moderation failed', e);
		return new Response('donation moderation failed', { status: 500 });
	}
};

// the name and message are checked together in one request; empty ones aren't sent
async function moderateDonation(donation: Donation) {
	const fields = (['name', 'message'] as const).filter((f) => donation[f]);
	if (fields.length === 0) return;

	openaiClient ??= new openai({ apiKey: env.OPENAI_API_KEY });
	const resp = await openaiClient.moderations.create({
		model: 'omni-moderation-2024-09-26',
		input: fields.map((f) => donation[f]!)
	});

	// results come back in the same order as the inputs
	fields.forEach((f, i) => {
		if (resp.results[i]?.flagged) donation[f] = undefined;
	});
}
