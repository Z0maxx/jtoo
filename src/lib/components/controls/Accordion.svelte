<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { slide } from 'svelte/transition';

	type Props = {
		title: string;
		children: Snippet;
		defaultstate?: 'open' | 'closed';
	};

	let { title, children, defaultstate = 'open' }: Props = $props();

	let open = $state(untrack(() => defaultstate === 'open'));
</script>

<div class="relative w-full max-w-lg self-center">
	<button
		class="w-full text-left"
		aria-expanded={open}
		onclick={() => {
			open = !open;
		}}
	>
		<span class="align-middle {open ? 'icon-[mdi--chevron-down]' : 'icon-[mdi--chevron-right]'}"
		></span>
		<span>{title}</span></button
	>
	{#if open}
		<div class="mb-2 flex flex-col gap-1" transition:slide>
			{@render children()}
		</div>
	{/if}
	<hr class="hr" />
</div>
