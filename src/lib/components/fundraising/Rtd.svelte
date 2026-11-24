<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import { rtdEffects } from '$lib/websockets/jf-rtd/jf-rtd.svelte';
	import { onDestroy } from 'svelte';

	//fundraisingState.current.lastDonationProcessedByRtdId = ''
	const rtdAmount = 20;
	const donationsSubId = Dwb.subscribeToDonations((donations) => {
		// donations[0].message = 'rtd: snail';
		// donations[0].amount = 30;
		const idx = donations.findIndex(
			(d) => d.id === fundraisingState.current.lastDonationProcessedByRtdId
		);
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
