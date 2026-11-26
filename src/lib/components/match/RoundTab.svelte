<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import { overlay, settings } from '$lib/storage.svelte';
	import { getMap } from '$lib/util';
	import { fade } from 'svelte/transition';

	// the stage above the map's name, on a tab hanging from the top bar, as wide as its text.
	// Positioned by the scene: centred has both sides slanted, right has only its left side
	// slanted and sits against the screen's right edge, like the old map tag
	type Props = { class?: string; align?: 'center' | 'right' };
	let { class: styleClass = '', align = 'center' }: Props = $props();

	let mapLabel = $derived(
		settings.current.useShortMapNames ? getMap(overlay.current.map).shortName : overlay.current.map
	);

	// each slanted side is a box skewed from its top edge, with the outline on its outer side and
	// bottom and its outer bottom corner rounded. It runs past the middle (or the screen's edge)
	// and is cut off there, so only the slanted side shows
	const side = 'absolute inset-y-0 origin-top border-b-3 border-ctp-lavender/30 bg-ctp-base/75';
</script>

{#if overlay.current.stage || overlay.current.map}
	<div transition:fade class={styleClass}>
		<div
			class="relative isolate flex h-17.5 flex-col justify-center gap-0.5
            {align === 'right' ? 'items-end pr-6 pl-16 text-right' : 'items-center px-16'}"
		>
			<!-- background and outline -->
			<div class="absolute inset-0 -z-1" style:filter={getFiltersStyle()}>
				{#if align === 'right'}
					<div class="absolute inset-0 overflow-hidden">
						<div class="{side} -right-12 left-0 skew-x-30 rounded-bl-[10px] border-l-3"></div>
					</div>
				{:else}
					<div class="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
						<div class="{side} -right-12 left-0 skew-x-30 rounded-bl-[10px] border-l-3"></div>
					</div>
					<div class="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
						<div class="{side} right-0 -left-12 -skew-x-30 rounded-br-[10px] border-r-3"></div>
					</div>
				{/if}
			</div>
			{#if overlay.current.stage}
				{#key overlay.current.stage}
					<span
						in:fade
						class="text-[15px] leading-none font-medium tracking-[0.14em] whitespace-nowrap text-ctp-lavender uppercase"
						style:filter={getFiltersStyle()}
					>
						{overlay.current.stage}
					</span>
				{/key}
			{/if}
			{#if mapLabel}
				{#key mapLabel}
					<span in:fade class="text-[30px] leading-tight font-bold whitespace-nowrap">
						{mapLabel}
					</span>
				{/key}
			{/if}
		</div>
	</div>
{/if}
