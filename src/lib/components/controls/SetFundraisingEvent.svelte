<script lang="ts">
	import { fundraisingState } from '$lib/storage.svelte';
	import Accordion from './Accordion.svelte';

	type Error = { state: boolean; msg: string };

	const dwbUrlPrefix = 'https://events.doctorswithoutborders.org/';
	let url = $state(fundraisingState.current.eventUrl);
	let fetched = $state(!!fundraisingState.current.eventUrl);
	let error = $state({
		invalidUrl: { state: false, msg: 'error: invalid DWB event url' } as Error
	});

	async function onSearch() {
		fetched = false;
		if (!url || !url.startsWith(dwbUrlPrefix)) {
			error.invalidUrl.state = true;
			return;
		}

		const resp = await fetch(`/api/dwb/participants/${url.split('/').at(-1)}`);
		if (resp.status === 404) {
			error.invalidUrl.state = true;
			return;
		}

		error.invalidUrl.state = false;
		fundraisingState.current.eventUrl = url;
		fundraisingState.current.donations = [];
		fundraisingState.current.lastDisplayedDonationId = '';
		fetched = true;
	}

	$effect(() => {
		url = fundraisingState.current.eventUrl;
		fetched = !!fundraisingState.current.eventUrl;
	});
</script>

<Accordion title="fundraising event" defaultstate="closed">
	<form
		class="flex flex-col gap-1"
		onsubmit={(e) => {
			e.preventDefault();
			onSearch();
		}}
	>
		<div class="flex gap-2">
			<label for="input-fundraising-url">url: </label>
			<input
				type="text"
				class="input w-full {fetched ? 'border-b-green-700' : ''}"
				id="input-fundraising-url"
				placeholder={dwbUrlPrefix}
				value={url}
				onkeyup={(e) => {
					url = (e.target as HTMLInputElement).value;
				}}
			/>
		</div>
		<div class="flex gap-2">
			<button class="button button-unselected hover:button-selected" type="submit">fetch</button>
		</div>
	</form>
	{#each Object.values(error) as e, i (i)}
		{#if e.state}
			<div>{e.msg}</div>
		{/if}
	{/each}
</Accordion>
