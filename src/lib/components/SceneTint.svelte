<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { onIdleScene, showSceneBackground } from '$lib/obs-browser-source.svelte';
	import { settings } from '$lib/storage.svelte';

	// the translucent backdrop behind a scene's content; place it inside the scene's relative container
	let { class: className = '' }: { class?: string } = $props();
</script>

{#if showSceneBackground()}
	{#if settings.current.enableGradient}
		<!-- gradients -->
		{#if settings.current.enableTeamColors}
			<div
				class="absolute top-0 left-0 size-full bg-linear-to-r from-ctp-blue/35 via-black/35 to-ctp-red/35 {className}"
			></div>
		{:else}
			<div
				class="absolute top-0 left-0 size-full bg-linear-to-r from-ctp-lavender/35 via-black/35 to-ctp-lavender/35 {className}"
				style:filter={getFiltersStyle()}
			></div>
		{/if}
	{:else}
		<!-- transparent black bg -->
		<div class="absolute top-0 left-0 size-full bg-black/35 {className}"></div>
	{/if}
{:else if onIdleScene()}
	<!-- the Idle scene has no backgrounds, but sits over busy game footage, so a plain darker
	     backdrop keeps the text readable -->
	<div class="absolute top-0 left-0 size-full bg-black/75 {className}"></div>
{/if}
