<script lang="ts">
	import { fundraisingState } from '$lib/storage.svelte';
	import type { Donation } from '$lib/types.svelte';

	type Props = { donations: Donation[] };
	let { donations }: Props = $props();
</script>

<div
	class="flex origin-top-left flex-col gap-2
    {fundraisingState.current.stage === 3 ? 'donations-animation' : ''}"
>
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

<style>
	@keyframes donations {
		0% {
			transform: translateY(0);
		}

		100% {
			transform: translateY(2em);
		}
	}

	.donations-animation {
		animation:
			donations 700ms cubic-bezier(0.63, 2.06, 0, 0.07) forwards,
			donations 300ms ease-out var(--restore-animation-after) reverse forwards;
	}
</style>
