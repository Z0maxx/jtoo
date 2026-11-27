<script lang="ts">
	import { defaultFundraisingState, fundraisingState } from '$lib/storage.svelte';
	import Accordion from './Accordion.svelte';
	import ConfirmButton from './ConfirmButton.svelte';

	type Error = { state: boolean; msg: string };

	const dwbUrlPrefix = 'https://events.doctorswithoutborders.org/';
	// fundraisingState changes all the time (donations, the progress bar), so the saved url gets
	// its own derived: the input below only resets when the url itself changes, not mid-typing
	const savedUrl = $derived(fundraisingState.current.eventUrl);
	let url = $derived(savedUrl);
	let fetched = $derived(!!savedUrl);
	let error = $state({
		invalidUrl: { state: false, msg: 'error: invalid DWB event url' } as Error
	});

	// a fresh fundraising state for the given event, or none: a copy, so later changes don't
	// write into the defaults
	function resetFundraising(eventUrl: string) {
		fundraisingState.current = { ...structuredClone(defaultFundraisingState), eventUrl };
	}

	// no event hides the overlay's fundraising section and stops fetching donations
	function clearEvent() {
		error.invalidUrl.state = false;
		resetFundraising('');
	}

	async function onSearch() {
		// an emptied field clears the event, the same as the clear button
		if (!url.trim()) {
			clearEvent();
			return;
		}

		fetched = false;
		if (!url.startsWith(dwbUrlPrefix)) {
			error.invalidUrl.state = true;
			return;
		}

		const resp = await fetch(`/api/dwb/participants/${url.split('/').at(-1)}`);
		if (resp.status === 404) {
			error.invalidUrl.state = true;
			return;
		}

		error.invalidUrl.state = false;
		resetFundraising(url);
		fetched = true;
	}
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
				bind:value={url}
			/>
		</div>
		<div class="flex items-center gap-2">
			<button class="button button-unselected hover:button-selected" type="submit">fetch</button>
			{#if savedUrl}
				<ConfirmButton onconfirm={clearEvent}>clear</ConfirmButton>
			{:else}
				<span class="opacity-60">no event set: the fundraising section is hidden</span>
			{/if}
		</div>
	</form>
	{#each Object.values(error) as e, i (i)}
		{#if e.state}
			<div class="text-red-300">{e.msg}</div>
		{/if}
	{/each}
</Accordion>
