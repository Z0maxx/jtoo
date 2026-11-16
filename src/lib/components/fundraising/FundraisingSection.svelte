<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import type { Donation } from '$lib/types.svelte';
	import { sleep } from '$lib/util';
	import { onDestroy } from 'svelte';
	import DonationNotification from './DonationNotification.svelte';
	import Milestones from './Milestones.svelte';
	import Overview from './Overview.svelte';
	import Donations from './Donations.svelte';

	fundraisingState.current.lastDisplayedDonationId = '';
	const displayedDonationCount = 3;
	let iteratingDonations = false;
	const iterateDonations = () => settings.current.enableFundraisingDonations;
	let donationNotificationOpen = $state(false);
	let currentDonation: Donation = $state({
		id: '',
		name: '',
		amount: 0
	});

	let donations: Donation[] = $state([]);
	let displayedDonations: Donation[] = $state([]);
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
			displayedDonations = [donation, ...displayedDonations.slice(0, displayedDonationCount - 1)];
			currentDonation = donation;
			donationNotificationOpen = true;
			i++;
			await sleep(settings.current.fundraisingShowDonationSeconds * 1000);
			donationNotificationOpen = false;
			await sleep(1 * 1000);
		}

		displayedDonations = donations.toReversed().slice(0, displayedDonationCount);
		iteratingDonations = false;
	}
</script>

<div class="relative mx-4 my-2 h-full">
	<Overview />
	<div class="mt-4 flex gap-4">
		<div class="w-3/4">
			<Milestones />
		</div>
		<div class="w-1/4">
			<Donations donations={displayedDonations} />
		</div>
	</div>
	<div class="absolute top-0 left-0 flex h-full w-full items-center justify-center">
		<DonationNotification open={donationNotificationOpen} donation={currentDonation} />
	</div>
</div>
