<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import type { Donation } from '$lib/types.svelte';
	import { sleep } from '$lib/util';
	import { onDestroy } from 'svelte';

	/*fundraisingState.current.displayedDonations = [];
	fundraisingState.current.lastDonationProcessedByDonationsId = '';*/

	const displayedDonationCount = 7;
	let latestDonations: Donation[] = [];
	let processing = false;
	let destroyed = false;

	const iterateDonations = () => settings.current.enableFundraisingDonations;

	const donationsSubId = Dwb.subscribeToDonations((donations) => {
		latestDonations = donations;
		processNewDonations();
	});

	onDestroy(() => {
		destroyed = true;
		Dwb.unsubscribeFromDonations(donationsSubId);
	});

	async function processNewDonations() {
		if (processing) return;

		processing = true;
		let pending = unprocessed(latestDonations);
		while (pending.length > 0) {
			if (!iterateDonations()) {
				await sleep(2 * 1000);
				continue;
			}

			for (const d of pending) {
				if (destroyed) return;
				if (!iterateDonations()) break;

				fundraisingState.current.lastDonationProcessedByDonationsId = d.id;
				fundraisingState.current.displayedDonations = [
					d,
					...fundraisingState.current.displayedDonations.slice(0, displayedDonationCount - 1)
				];

				await sleep(settings.current.fundraisingShowDonationSeconds * 1000);
			}

			pending = unprocessed(latestDonations);
		}

		processing = false;
	}

	function unprocessed(donations: Donation[]): Donation[] {
		let idx = donations.findIndex(
			(d) => d.id === fundraisingState.current.lastDonationProcessedByDonationsId
		);

		return donations.slice(idx + 1);
	}
</script>

<div
	class="flex origin-top-left flex-col gap-2
    {fundraisingState.current.animationStage === 3 ? 'donations-animation' : ''}"
>
	{#each fundraisingState.current.displayedDonations as donation (donation.id)}
		<div class="flex flex-col items-center rounded-md border-2 bg-bordeaux">
			<span class="max-w-full overflow-hidden truncate text-xl">{donation.name ?? 'Anonymous'}</span>
			<div>${donation.amount}</div>
		</div>
	{/each}
</div>

<style>
	@keyframes donations {
		0% {
			transform: translateY(0);
		}

		100% {
			transform: translateY(2em);
		}
	}

	.donations-animation {
		animation:
			donations 700ms cubic-bezier(0.63, 2.06, 0, 0.07) forwards,
			donations 300ms ease-out var(--restore-animation-after) reverse forwards;
	}
</style>
