<script lang="ts">
	import { fundraisingState } from '$lib/storage.svelte';
	import type { Donation } from '$lib/types.svelte';

	type Props = { donations: Donation[] };
	let { donations }: Props = $props();
</script>

<div class="flex flex-col gap-2 origin-top-left duration-300 ease-in {fundraisingState.current.animationStage === 1 ? 'rotate-[9deg]' : ''}">
	{#each donations as donation}
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
