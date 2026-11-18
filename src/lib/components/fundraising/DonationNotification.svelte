<script lang="ts">
	import type { Donation } from '$lib/types.svelte';

	type Props = { open: boolean; donation: Donation };
	let { open, donation }: Props = $props();
</script>

<div
	class="z-50 flex flex-col items-center rounded-md border-2 border-sky-800 bg-sky-900 px-2 transition-all duration-400 {open
		? 'mt-0 opacity-100'
		: '-mt-10 opacity-0'}"
>
	<div class="flex items-center gap-1 text-xl">
		{#if donation.avatarUrl}
			<img src={donation.avatarUrl} alt="avatar" class="size-6 rounded-full" />
		{/if}
		<span>{donation.name}</span>
	</div>
	<div>${donation.amount}</div>
	<div>{donation.message ?? 'test donation message very long very much'}</div>
</div>
