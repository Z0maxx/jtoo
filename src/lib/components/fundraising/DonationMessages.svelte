<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import type { Donation } from '$lib/types.svelte';
	import { sleep } from '$lib/util';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { onDestroy } from 'svelte';

	// two donation message cards side by side, filling the size the scene gives them
	type Props = { class?: string };
	let { class: styleClass = '' }: Props = $props();

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

<div class="{styleClass} grid grid-cols-2 gap-3.5">
	{#each fundraisingState.current.displayedDonationsWithMessages as donation, i (i)}
		<!-- an empty slot keeps its place until a message fills it -->
		<div class="relative isolate min-h-0">
			{#if donation.id !== ''}
				<div
					class="flex h-full flex-col gap-2.5 overflow-hidden px-4.5 py-3.5 transition-colors duration-300
                    {donation.id === replaced ? 'text-transparent' : ''}"
				>
					<div
						class="absolute inset-0 -z-1 rounded-[10px] bg-[#0f0f16]/92 ring-1 ring-ctp-lavender/35 ring-inset"
						style:filter={getFiltersStyle()}
					></div>
					<div class="flex items-center gap-2.5">
						<span class="truncate text-[21px] font-bold" style:filter={getFiltersStyle()}
							>{donation.name || 'Anonymous'}</span
						>
						<span
							class="ml-auto text-[21px] {donation.id === replaced
								? ''
								: 'text-ctp-lavender'} {settings.current.monoFont}"
							style:filter={getFiltersStyle()}
						>
							${donation.amount.toLocaleString('en-US')}
						</span>
					</div>
					<p
						class="m-0 line-clamp-4 text-lg leading-snug
                                                {donation.id === replaced
							? ''
							: 'text-ctp-subtext1'}"
						style:filter={getFiltersStyle()}
					>
						{donation.message}
					</p>
				</div>
			{/if}
		</div>
	{/each}
</div>
