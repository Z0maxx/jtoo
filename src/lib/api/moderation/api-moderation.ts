import type { Donation } from '$lib/types.svelte';
import { deepCopy, sleep } from '$lib/util';

export namespace Moderation {
	// how many donations are checked at once, so a first load with a long history doesn't send
	// every request together and run into openai's rate limit
	const maxConcurrent = 4;

	export async function moderateDonations(donations: Donation[]): Promise<Donation[]> {
		const moderated = new Array<Donation>(donations.length);
		let next = 0;

		async function worker() {
			while (next < donations.length) {
				const i = next++;
				moderated[i] = await moderateDonation(donations[i]!);
			}
		}

		await Promise.all(Array.from({ length: Math.min(maxConcurrent, donations.length) }, worker));
		return moderated;
	}

	// a failed check is retried with a growing delay (2s, 4s, 8s) before giving up, since a
	// donation is only fetched once and a given-up one stays hidden for good
	const maxAttempts = 4;
	const baseRetryDelay = 2000;

	async function moderateDonation(donation: Donation) {
		for (let attempt = 1; ; attempt++) {
			try {
				return await fetchModeratedDonation(donation);
			} catch (e) {
				if (e instanceof PermanentModerationError || attempt >= maxAttempts) {
					console.error(`donation moderation gave up after ${attempt} attempt(s)`, e);
					return defaultModeratedDonation(donation);
				}
				await sleep(baseRetryDelay * 2 ** (attempt - 1));
			}
		}
	}

	// a bad request won't get any better by sending it again
	class PermanentModerationError extends Error {}

	async function fetchModeratedDonation(donation: Donation) {
		const resp = await fetch('/api/moderation/donation', {
			method: 'POST',
			body: JSON.stringify({
				donation
			})
		});

		if (resp.status === 400) {
			throw new PermanentModerationError(`donation moderation: ${resp.status}`);
		}
		if (resp.status !== 200) {
			throw new Error(`donation moderation: ${resp.status}`);
		}

		const { moderatedDonation } = (await resp.json()) as { moderatedDonation: Donation };
		return moderatedDonation;
	}

	function defaultModeratedDonation(donation: Donation) {
		const copy = deepCopy(donation);
		copy.message = undefined;
		copy.name = undefined;
		return copy;
	}
}
