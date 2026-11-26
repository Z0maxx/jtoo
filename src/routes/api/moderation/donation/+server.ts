import { env } from '$env/dynamic/private';
import type { Donation } from '$lib/types.svelte';
import type { RequestHandler } from '@sveltejs/kit';
import openai from 'openai';
import { ConsolePlugin } from 'sveltekit-plugin-console';

// created on first request: the key isn't available at build time, when sveltekit imports this module
let openaiClient: openai | undefined;

export const POST: RequestHandler = async (request) => {
	try {
		const { donation } = (await request.request.json()) as { donation?: Donation };
		if (!donation) {
			return new Response('no donation', { status: 400 });
		}

		await moderateName(donation);
		await moderateMessage(donation);
		return new Response(JSON.stringify({ moderatedDonation: donation }), { status: 200 });
	} catch (e) {
		// the error stays in the server log: it can carry details of the openai request
		console.error('donation moderation failed', e);
		return new Response('donation moderation failed', { status: 500 });
	}
};

async function moderateName(donation: Donation) {
	if (await isFlagged(donation.name)) {
		donation.name = undefined;
	}
}

async function moderateMessage(donation: Donation) {
	if (await isFlagged(donation.message)) {
		donation.message = undefined;
	}
}

async function isFlagged(content: string | undefined) {
	openaiClient ??= new openai({ apiKey: env.OPENAI_API_KEY });
	const resp = await openaiClient.moderations.create({
		model: 'omni-moderation-2024-09-26',
		input: [{ type: 'text', text: content ?? '' }]
	});

	return Object.entries(resp.results[0].categories).some(([_, flagged]) => flagged);
}
