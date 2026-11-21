<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { settings } from '$lib/storage.svelte';
	import { rtdEffects } from '$lib/websockets/jf-rtd/jf-rtd.svelte';
	import { onDestroy } from 'svelte';

  const customRtdAmount = 30
  const randomRtdAmount = 20
	const donationsSubId = Dwb.subscribeToDonations((donations) => {
		donations.forEach((d) => {
			let effect: string | undefined;
			if (
				d.amount >= customRtdAmount &&
				d.message &&
				rtdEffects.some((e) => d.message?.toLowerCase().endsWith('rtd ' + e))
			) {
				effect = d.message.split(' ').at(-1);
			} else if (d.amount >= randomRtdAmount) {
				effect = rtdEffects[Math.floor(Math.random() * rtdEffects.length)];
			}

			if (effect) {
				fetch(`/api/rtd/${effect}?token=${settings.current.jfRelayWebSocketToken}`).then(async resp => {
          if (resp.status !== 204) {
            console.error(await resp.text())
          }
        });
			}
		});
	});

	onDestroy(() => {
		Dwb.unsubscribeFromDonations(donationsSubId);
	});
</script>

<div>
	<h2 class="text-center text-3xl">RTD enabled!</h2>
	<div class="rounded-md border-2 border-lime-900 bg-lime-800 px-2 py-1">
		Donations with at least $20: random RTD effect
	</div>
	<div class="mt-2 rounded-md border-2 border-lime-900 bg-lime-800 px-2 py-1">
		Donations with at least $30: specific RTD effect!
		<br />
		Include 'rtd &lt;effect&gt;' at the end of your message, for example 'rtd snail'
	</div>
	<div class="mt-2 flex flex-wrap gap-2">
		<span>effects:</span>
		{#each rtdEffects as effect}
			<span class="rounded-md bg-lime-700 px-1">{effect}</span>
		{/each}
	</div>
</div>
