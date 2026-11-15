<script lang="ts">
	import { fundraisingState } from '$lib/storage.svelte';
	import PopOver from './PopOver.svelte';

	type Error = { state: boolean; msg: string };
	type Props = { container?: boolean };

	const dwbUrlPrefix = 'https://events.doctorswithoutborders.org/';
	let url = $state(fundraisingState.current.eventUrl);
	let fetched = $state(!!fundraisingState.current.eventUrl);
	let popoverState: 'open' | 'closed' = $state('closed');
	let error = $state({
		invalidUrl: { state: false, msg: 'error: invalid DWB event url' } as Error
	});

	let { container = true }: Props = $props();

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
	}

	$effect(() => {
		url = fundraisingState.current.eventUrl;
		fetched = !!fundraisingState.current.eventUrl;
	});
</script>

<PopOver title="set fundraising event" bind:state={popoverState} {container}>
	<section class="grid grid-cols-12 gap-2">
		<form class="col-span-full flex gap-2" onsubmit={() => onSearch()}>
			<label for="url">search</label>
			<input
				class="remove-arrow input w-full {fetched ? 'border-b-green-700' : ''}"
				value={url}
				type="text"
				id="url"
				placeholder="url"
				onkeyup={(e) => {
					url = (e.target as HTMLInputElement).value;
				}}
			/>
			<button class="button min-w-16" type="submit">fetch</button>
		</form>

		<hr class="hr" />

		<div class="col-span-6 flex flex-col">
			{#each Object.values(error) as e, i (i)}
				{#if e.state}
					<div>{e.msg}</div>
				{/if}
			{/each}
		</div>
	</section>
</PopOver>
