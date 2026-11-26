<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import type { Donation } from '$lib/types.svelte';
	import { sleep } from '$lib/util';
	import { onDestroy } from 'svelte';

	/*fundraisingState.current.displayedDonationsWithMessages = [];
	fundraisingState.current.lastDonationProcessedByMessagesId = '';*/

	let switchIdx = 0;
	let latestDonations: Donation[] = [];
	let processing = false;
	let destroyed = false;

	let replaced: string | null = $state(null);

	if (fundraisingState.current.displayedDonationsWithMessages.length === 0) {
		fundraisingState.current.displayedDonationsWithMessages = Array.from({ length: 2 }).map(() => ({
			id: '',
			name: '',
			amount: 0,
			createdAt: ''
		}));
	}

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

				fundraisingState.current.lastDonationProcessedByMessagesId = d.id;
				if (!d.message) continue;

				const lastEmpty = fundraisingState.current.displayedDonationsWithMessages.findIndex(
					(d) => d.id === ''
				);

				if (lastEmpty > -1) {
					fundraisingState.current.displayedDonationsWithMessages[lastEmpty] = d;
				} else {
					replaced = fundraisingState.current.displayedDonationsWithMessages[switchIdx].id;
					await sleep(300);
					replaced = '';
					fundraisingState.current.displayedDonationsWithMessages[switchIdx] = d;
					switchIdx = 1 - switchIdx;
				}

				await sleep(settings.current.fundraisingShowDonationSeconds * 1000);
			}

			pending = unprocessed(latestDonations);
		}

		processing = false;
	}

	function unprocessed(donations: Donation[]): Donation[] {
		let idx = donations.findIndex(
			(d) => d.id === fundraisingState.current.lastDonationProcessedByMessagesId
		);

		return donations.slice(idx + 1);
	}
</script>

<div class="z-50 flex items-center gap-2 px-2 transition-all duration-400">
	{#each fundraisingState.current.displayedDonationsWithMessages as donation, i (i)}
		<div
			class="flex h-90 w-120 flex-col items-center rounded-md border-2 border-white bg-bordeaux px-2 py-1 transition-colors
        {donation.id === replaced ? 'text-transparent' : ''}"
		>
			{#if donation.id !== ''}
				<div class="flex items-center gap-1 text-xl">
					<span>{donation.name ?? 'Anonymous'}</span>
				</div>
				<div>${donation.amount}</div>
				<div class="max-w-full truncate overflow-hidden text-wrap">
					{donation.message}
				</div>
			{/if}
		</div>
	{/each}
</div>
