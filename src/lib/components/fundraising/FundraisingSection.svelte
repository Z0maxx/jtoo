<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import type { Donation } from '$lib/types.svelte';
	import { sleep } from '$lib/util';
	import { onDestroy } from 'svelte';
	import Milestones from './Milestones.svelte';
	import Overview from './Overview.svelte';
	import Donations from './Donations.svelte';
	import Rtd from './Rtd.svelte';

	/*fundraisingState.current.lastDisplayedDonationId = '';
	fundraisingState.current.displayedDonations = [];*/
	const displayedDonationCount = 7;
	let iteratingDonations = false;
	const iterateDonations = () => settings.current.enableFundraisingDonations;
	let donations: Donation[] = [];
	const donationsSubId = Dwb.subscribeToDonations((newDonations) => {
		donations = newDonations;
		displayNewDonations();
	});

	onDestroy(() => {
		Dwb.unsubscribeFromDonations(donationsSubId);
	});

	async function displayNewDonations() {
		if (iteratingDonations) return;
		iteratingDonations = true;

		const idx = donations.findIndex(
			(d) => d.id === fundraisingState.current.lastDisplayedDonationId
		);

		let i = idx > -1 ? idx + 1 : 0;
		while (i < donations.length) {
			if (!iterateDonations()) {
				await sleep(2 * 1000);
				continue;
			}

			const donation = donations[i];
			fundraisingState.current.lastDisplayedDonationId = donation.id;
			fundraisingState.current.displayedDonations = [
				donation,
				...fundraisingState.current.displayedDonations.slice(0, displayedDonationCount - 1)
			];
			i++;
			await sleep(settings.current.fundraisingShowDonationSeconds * 1000);
		}

		fundraisingState.current.displayedDonations = donations
			.toReversed()
			.slice(0, displayedDonationCount);
		iteratingDonations = false;
	}
</script>

<div class="relative mx-4 my-2 h-full text-white">
	<Overview />
	<div class="mt-4 flex gap-4">
		<div class="w-2/4">
			<Milestones />
		</div>
		<div class="w-1/4">
			{#if settings.current.enableFundraisingRtd}
				<Rtd />
			{/if}
		</div>
		<div class="w-1/4">
			<Donations />
		</div>
	</div>
</div>

<style>
	:global(:root) {
		/*--restore-animation-after: 2s*/
		--restore-animation-after: 10s;
	}
</style>
