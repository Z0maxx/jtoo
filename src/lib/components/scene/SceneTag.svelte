<script lang="ts">
	import type { Snippet } from 'svelte';

	// the boxed label under a scene header's logo, eg: the match's stage or the stream link
	let { class: className = '', children }: { class?: string; children: Snippet } = $props();
</script>

<div
	class="flex items-center gap-4 border-2 border-ctp-lavender/35 bg-ctp-lavender/10 px-5 py-2 font-bold text-white {className}"
>
	{@render children()}
</div>
