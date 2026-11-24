<script lang="ts">
	import '../layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { settings } from '$lib/storage.svelte';
	import MovingBackground from '$lib/components/MovingBackground.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="flex h-screen w-full flex-col overflow-hidden {settings.current.font}">
	{@render children()}

	{#if settings.current.enableMovingBG && settings.current.overlayScene != 'SinglePovMatchScene'}
		<MovingBackground />
	{/if}
</div>
