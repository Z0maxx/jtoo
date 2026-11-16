<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import type { DonationsOverview } from '$lib/types.svelte';
	import { onDestroy } from 'svelte';

	let overview: DonationsOverview = $state({
		goal: 0,
		raised: 0,
		donationCount: 0
	});

	const overviewSubId = Dwb.subscribeToDonationsOverview((newOverview) => {
		overview = newOverview;
	});

	onDestroy(() => {
		Dwb.unsubscribeFromDonationsOverview(overviewSubId);
	});

	let goalPercentage = $derived(() => Math.min((overview.raised / overview.goal) * 100, 100));
</script>

<div>
	<div class="flex justify-between text-3xl">
		<span>${overview.raised} Raised</span>
		<span>{overview.donationCount} Donations</span>
		<span>${overview.goal} Goal</span>
	</div>
	<div class="h-5 w-full overflow-hidden rounded-md bg-gray-400">
		<div style="width: {goalPercentage()}%" class="h-full bg-green-500"></div>
	</div>
</div>
