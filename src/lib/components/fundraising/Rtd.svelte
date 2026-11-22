<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { settings } from '$lib/storage.svelte';
	import { rtdEffects } from '$lib/websockets/jf-rtd/jf-rtd.svelte';
	import { onDestroy } from 'svelte';

	const rtdAmount = 20;
	const donationsSubId = Dwb.subscribeToDonations((donations) => {
		donations.forEach((d) => {
			if (d.amount < rtdAmount) return;

			const message = d.message?.toLowerCase();
			const effect = rtdEffects.find(
				(e) => message?.includes('rtd ' + e) || message?.includes('rtd: ' + e)
			);
      
			if (!effect) return;

			fetch(`/api/rtd/${effect}?token=${settings.current.jfRelayWebSocketToken}`).then(
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
	<div class="rounded-md border-2 bg-bordeaux px-2 py-1">
		Donations with at least $20: random RTD effect
	</div>
	<div class="rounded-md border-2 bg-bordeaux px-2 py-1">
		Donations with at least $30: specific RTD effect!
		<br />
		Include 'rtd &lt;effect&gt;' at the end of your message, for example 'rtd snail'
	</div>
	<div class="rounded-md border-2 bg-bordeaux px-2 py-1">
		Type !rtd in the chat to see available RTD effects
	</div>
</div>
