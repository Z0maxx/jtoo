<script lang="ts">
	import { getFiltersStyle } from '$lib/filters.svelte';
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { fitText } from '$lib/fit-text';
	import { settings } from '$lib/storage.svelte';
	import jfLogo from '$lib/assets/jf-logo.png';

	// a full-page scene's header: the event name over a title that shrinks to fit, a subtitle
	// under that, and the logo on the right with anything the scene puts under it. live adds
	// '· ● Live' after the title, for something still in progress
	let {
		eventName = '',
		title,
		live = false,
		subtitle,
		aside
	}: {
		eventName?: string;
		title: string;
		live?: boolean;
		subtitle?: Snippet;
		aside?: Snippet;
	} = $props();
</script>

<header class="flex items-start justify-between gap-12">
	<!-- flex-1 gives the column the header's spare width, which the title shrinks to fit -->
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		{#if eventName}
			<span
				class="text-2xl tracking-[0.18em] text-ctp-subtext0 uppercase"
				style:filter={getFiltersStyle()}>{eventName}</span
			>
		{/if}
		<!-- a new title fades in; the first one shows at once -->
		{#key `${title}|${live}`}
			<h1
				in:fade={{ duration: 400 }}
				class="leading-none font-bold tracking-tight text-white uppercase"
				{@attach fitText(112, settings.current.font)}
			>
				{title}
				{#if live}
					<!-- inside the heading, so the title fits around it. the label is smaller than the
					     title, so it's raised to centre its capitals on the title's: half of the
					     difference in cap height (about 0.7 of the font size), with em the title's size
					     and 3rem the label's (text-5xl) -->
					<span
						class="ml-[0.1em] inline-flex items-center gap-[0.1em] align-[calc(0.35em-1.05rem)]"
					>
						<span class="size-[0.20em] rounded-full bg-ctp-red"></span>
						<span class="text-5xl text-ctp-red">Live</span>
					</span>
				{/if}
			</h1>
		{/key}
		{@render subtitle?.()}
	</div>
	<div class="flex shrink-0 flex-col items-end gap-4">
		<img src={jfLogo} alt="Jump Fortress" class="size-32 object-contain" draggable="false" />
		{@render aside?.()}
	</div>
</header>
