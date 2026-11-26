import type { Donation } from '$lib/types.svelte';
import { deepCopy } from '$lib/util';

export namespace Moderation {
	export async function moderateDonations(donations: Donation[]): Promise<Donation[]> {
		return await Promise.all(
			donations.map(async (d) => {
				try {
					return await fetchModeratedDonation(d);
				} catch (e) {
					console.log(e);
					return defaultModeratedDonation(d);
				}
			})
		);
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
