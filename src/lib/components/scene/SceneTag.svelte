<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import type { Snippet } from 'svelte';

	// the boxed label under a scene header's logo, eg: the match's stage or the stream link
	let { class: className = '', children }: { class?: string; children: Snippet } = $props();
</script>

<!-- the box is its own layer, so the filters tint it without tinting what's in it, eg: the
     schedule's red live dot -->
<div class="relative isolate flex items-center gap-4 px-5 py-2 font-bold text-white {className}">
	<div
		class="absolute inset-0 -z-1 border-2 border-ctp-lavender/35 bg-ctp-lavender/10"
		style:filter={getFiltersStyle()}
	></div>
	{@render children()}
</div>
