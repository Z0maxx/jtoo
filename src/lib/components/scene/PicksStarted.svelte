<script lang="ts">
	import { getContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { getFiltersStyle } from '$lib/filters.svelte';
	import type { KSNWebSocket } from '$lib/websockets/ksn/ws-ksn.svelte';

	// a small note in a scene's bottom right corner while a pick & ban session is running, so
	// viewers on another scene know picks are underway
	const ksnWs: KSNWebSocket | undefined = getContext('ksnWs');
	let running = $derived(ksnWs?.messages.mapPicks?.session?.status === 'running');
</script>

{#if running}
	<div
		class="absolute right-8 bottom-6 flex items-center gap-3 text-xl tracking-[0.12em] text-ctp-subtext0"
		style:filter={getFiltersStyle()}
		transition:fade
	>
		<span class="size-3 animate-pulse rounded-full bg-ctp-lavender"></span>
		picks started...
	</div>
{/if}
