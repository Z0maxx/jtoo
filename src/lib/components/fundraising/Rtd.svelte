<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import { rtdEffects } from '$lib/websockets/jf-rtd/jf-rtd.svelte';
	import type { Donation } from '$lib/types.svelte';
	import { onDestroy } from 'svelte';

	//fundraisingState.current.lastDonationProcessedByRtdId = ''
	const rtdAmount = 20;
	const mountedAt = Date.now();
	let latestDonations: Donation[] = [];
	let processing = false;
	let destroyed = false;

	const donationsSubId = Dwb.subscribeToDonations((donations) => {
		// donations[0].message = 'rtd: snail';
		// donations[0].amount = 30;
		latestDonations = donations;
		processNewDonations();
	});

	onDestroy(() => {
		destroyed = true;
		Dwb.unsubscribeFromDonations(donationsSubId);
	});

	/**
	 * Sends the effects of new donations in order, one request at a time. Only one loop runs:
	 * donations that arrive while it's sending are picked up by it, not by a second loop that
	 * would send the same effects again.
	 */
	async function processNewDonations() {
		if (processing) return;
		processing = true;
		try {
			let pending = unprocessed(latestDonations);
			while (pending.length > 0) {
				for (const d of pending) {
					// a remounted component has its own loop
					if (destroyed) return;
					// marked before sending, so a donation never fires twice
					fundraisingState.current.lastDonationProcessedByRtdId = d.id;
					const effect = rtdEffectFor(d);
					if (effect) await sendRtdEffect(effect);
				}
				// donations that came in while effects were being sent
				pending = unprocessed(latestDonations);
			}
		} finally {
			processing = false;
		}
	}

	function unprocessed(donations: Donation[]): Donation[] {
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
		return donations.slice(idx + 1);
	}

	function rtdEffectFor(d: Donation): string | undefined {
		if (d.amount < rtdAmount) return undefined;
		const message = d.message?.toLowerCase();
		return rtdEffects.find((e) => message?.includes('rtd ' + e) || message?.includes('rtd: ' + e));
	}

	async function sendRtdEffect(effect: string) {
		try {
			const resp = await fetch(
				`/api/rtd/${effect}?token=${settings.current.jfRelayWebSocketToken}`
			);
			if (resp.status !== 204) {
				console.error(await resp.text());
			}
		} catch (e) {
			// one failed request shouldn't stop the donations after it
			console.error(`rtd: sending ${effect} failed`, e);
		}
	}
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
