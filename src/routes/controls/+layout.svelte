<script lang="ts">
	import '../layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="relative flex h-fit w-full max-w-3xl flex-col bg-obs-content p-4">
	{@render children()}
</div>

<style>
	:root {
		background-color: var(--color-obs-background);
		/* keep the scrollbar's space even when the page fits, so opening a section that makes the
		   page scroll doesn't shift the centred page sideways */
		scrollbar-gutter: stable;
	}
</style>
