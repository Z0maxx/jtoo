<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import type { Donation, DonationsOverview, DonationMilestone } from '$lib/types.svelte';
	import { sleep } from '$lib/util';
	import { onDestroy } from 'svelte';

	fundraisingState.current.lastDisplayedDonationId = '';
	const displayedDonationCount = 3;
	const iterateDonations = () => settings.current.enableFundraisingDonations;
	let donationPopupOpen = $state(false);
	let popupDonation: Donation = $state({
		id: '',
		name: '',
		amount: 0
	});

	let overview: DonationsOverview = $state({
		goal: 0,
		raised: 0,
		donationCount: 0
	});

	let donations: Donation[] = $state([]);
	let milestones: DonationMilestone[] = $state([
		{
			goal: 100,
			description: 'top 30 jumpers of all time stream with riot, matty and newjuls',
			isActive: false,
			isComplete: true
		},
		{
			goal: 250,
			description: 'LAN travel vlog ',
			isActive: true,
			isComplete: false
		},
		{
			goal: 500,
			description: 'Revive Jump Podcast',
			isActive: false,
			isComplete: false
		},
		{
			goal: 750,
			description: 'Replace soldier model with Medic model for rest of event',
			isActive: false,
			isComplete: false
		},
		{
			goal: 1000,
			description: 'Demos have to play soldier with sticky rockets for 1 map (during demo segment)',
			isActive: false,
			isComplete: false
		},
		{
			goal: 1250,
			description: 'roll the dice during demo segment',
			isActive: false,
			isComplete: false
		},
		{
			goal: 1500,
			description: 'roll the dice during beggars races',
			isActive: false,
			isComplete: false
		},
		{
			goal: 1750,
			description: 'Caster showmatch on 4dakids',
			isActive: false,
			isComplete: false
		},
		{
			goal: 2000,
			description: 'remove class restrictions for 6s vs jumpers (8 soldiers allowed)',
			isActive: false,
			isComplete: false
		},
		{
			goal: 3000,
			description: 'rtd enabled during 6v9',
			isActive: false,
			isComplete: false
		}
	]);

	let displayedDonations: Donation[] = $state([]);

	let goalPercentage = $derived(() => Math.min((overview.raised / overview.goal) * 100, 100));

	const overviewSubId = Dwb.subscribeToDonationsOverview((newOverview) => {
		overview = newOverview;
	});

	const donationsSubId = Dwb.subscribeToDonations((newDonations) => {
		donations = newDonations;
		displayNewDonations();
	});

	const milestonesSubId = Dwb.subscribeToMilestones((newMilestones) => {
		milestones = newMilestones;
	});

	onDestroy(() => {
		Dwb.unsubscribeFromDonationsOverview(overviewSubId);
		Dwb.unsubscribeFromMilestones(milestonesSubId);
		Dwb.unsubscribeFromDonations(donationsSubId);
	});

	async function displayNewDonations() {
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
			popupDonation = donation;
			donationPopupOpen = true;
			i++;
			await sleep(settings.current.fundraisingShowDonationSeconds * 1000);
			donationPopupOpen = false;
			await sleep(1 * 1000);
		}

		displayedDonations = donations.toReversed().slice(0, displayedDonationCount);
	}
</script>

<div class="relative mx-4 my-2 h-full">
	<div class="flex justify-between text-3xl">
		<span>${overview.raised} Raised</span>
		<span>{overview.donationCount} Donations</span>
		<span>${overview.goal} Goal</span>
	</div>
	<div class="h-5 w-full overflow-hidden rounded-md bg-gray-400">
		<div style="width: {goalPercentage()}%" class="h-full bg-green-500"></div>
	</div>
	<div class="mt-4 flex gap-4">
		<div class="w-3/4">
			<h2 class="text-xl">Milestones</h2>
			{#each milestones as milestone}
				<div class="flex gap-2">
					<div
						class="rounded-md {milestone.isComplete ? 'text-green-300' : ''} {milestone.isActive
							? 'text-amber-300'
							: ''}"
					>
						${milestone.goal}:
					</div>
					<div>{milestone.description}</div>
				</div>
			{/each}
		</div>
		<div class="flex w-1/4 flex-col gap-2">
			{#each displayedDonations as donation}
				<div class="flex flex-col items-center rounded-md border-2 border-blue-800 bg-blue-900">
					<div class="flex items-center gap-1 text-xl">
						{#if donation.avatarUrl}
							<img src={donation.avatarUrl} alt="avatar" class="size-6 rounded-full" />
						{/if}
						<span>{donation.name}</span>
					</div>
					<div>${donation.amount}</div>
				</div>
			{/each}
		</div>
	</div>
	<div class="absolute top-0 left-0 flex h-full w-full items-center justify-center">
		<div
			class="flex flex-col items-center rounded-md border-2 border-sky-800 bg-sky-900 px-2 transition-all duration-400 {donationPopupOpen
				? 'mt-0 opacity-100'
				: '-mt-10 opacity-0'}"
		>
			<div class="flex items-center gap-1 text-xl">
				{#if popupDonation.avatarUrl}
					<img src={popupDonation.avatarUrl} alt="avatar" class="size-6 rounded-full" />
				{/if}
				<span>{popupDonation.name}</span>
			</div>
			<div>${popupDonation.amount}</div>
			<div>{popupDonation.message ?? 'test donation message very long very much'}</div>
		</div>
	</div>
</div>
