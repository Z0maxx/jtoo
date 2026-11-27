import type { Donation } from '$lib/types.svelte';
import { deepCopy } from '$lib/util';

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

	async function moderateDonation(donation: Donation) {
		try {
			return await fetchModeratedDonation(donation);
		} catch (e) {
			console.log(e);
			return defaultModeratedDonation(donation);
		}
	}

	async function fetchModeratedDonation(donation: Donation) {
		const resp = await fetch('/api/moderation/donation', {
			method: 'POST',
			body: JSON.stringify({
				donation
			})
		});

		if (resp.status !== 200) {
			return defaultModeratedDonation(donation);
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
