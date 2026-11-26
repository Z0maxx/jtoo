<script lang="ts">
	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';

	type Props = {
		title: string;
		children: Snippet;
		defaultstate?: 'open' | 'closed';
		// bind to open or close it from outside, e.g. from the status bar
		open?: boolean;
		// for scrolling to it
		id?: string;
	};

	let {
		title,
		children,
		defaultstate = 'open',
		open = $bindable(defaultstate === 'open'),
		id
	}: Props = $props();
</script>

<!-- scroll-mt: room for the sticky status bar when it's scrolled to -->
<div class="relative w-full max-w-lg scroll-mt-12 self-center" {id}>
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
