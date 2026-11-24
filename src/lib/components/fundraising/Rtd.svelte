<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import { rtdEffects } from '$lib/websockets/jf-rtd/jf-rtd.svelte';
	import { onDestroy } from 'svelte';

	//fundraisingState.current.lastDonationProcessedByRtdId = ''
	const rtdAmount = 20;
	const mountedAt = Date.now();
	const donationsSubId = Dwb.subscribeToDonations((donations) => {
		// donations[0].message = 'rtd: snail';
		// donations[0].amount = 30;
		let idx = donations.findIndex(
			(d) => d.id === fundraisingState.current.lastDonationProcessedByRtdId
		);
		if (idx === -1) {
			// no record of what was processed (rtd just enabled, a new event or cleared storage):
			// treat donations from before this mounted as processed, so old ones don't fire again.
			// the list is oldest first; a donation without a valid date counts as old
			idx = donations.findLastIndex((d) => !(Date.parse(d.createdAt ?? '') >= mountedAt));
			// saved straight away, so later updates match by id instead of by date
			if (idx > -1) fundraisingState.current.lastDonationProcessedByRtdId = donations[idx].id;
		}
		donations.slice(idx + 1).forEach(async (d) => {
			fundraisingState.current.lastDonationProcessedByRtdId = d.id;
			if (d.amount < rtdAmount) return;

			const message = d.message?.toLowerCase();
			const effect = rtdEffects.find(
				(e) => message?.includes('rtd ' + e) || message?.includes('rtd: ' + e)
			);

			if (!effect) return;

			await fetch(`/api/rtd/${effect}?token=${settings.current.jfRelayWebSocketToken}`).then(
				async (resp) => {
					if (resp.status !== 204) {
						console.error(await resp.text());
					}
				}
			);
		});
	});

	onDestroy(() => {
		Dwb.unsubscribeFromDonations(donationsSubId);
	});
</script>

<div class="flex flex-col gap-2">
	<h2 class="text-center text-3xl">RTD enabled!</h2>
	<div class="flex flex-col gap-1 rounded-md border-2 bg-bordeaux px-2 py-1">
		<div>Donation at least $20: activate a specific RTD effect</div>
		<div>
			Include <span class="font-light italic">'rtd &lt;effect&gt;'</span> at the end of your
			message, for example
			<span class="font-light italic">'rtd snail'</span>
		</div>
	</div>
	<div class="rounded-md border-2 bg-bordeaux px-2 py-1">
		Type !rtd in the chat to see available RTD effects
	</div>
</div>
