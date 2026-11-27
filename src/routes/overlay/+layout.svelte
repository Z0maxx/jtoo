<script lang="ts">
	import '../layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { settings } from '$lib/storage.svelte';
	import MovingBackground from '$lib/components/MovingBackground.svelte';
	import { showSceneBackground } from '$lib/obs-browser-source.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="flex h-screen w-full flex-col overflow-hidden {settings.current.font}">
	{@render children()}

	{#if settings.current.enableMovingBG && settings.current.overlayScene != 'SinglePovMatchScene' && showSceneBackground()}
		<!-- the dual pov match scene keeps its povs clear for the gameplay under it -->
		<MovingBackground povCutout={settings.current.overlayScene === 'DualPovMatchScene'} />
	{/if}
</div>
