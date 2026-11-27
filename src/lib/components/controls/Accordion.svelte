<script module lang="ts">
	import { PersistentState } from '@friendofsvelte/state';

	// which accordions are open, by id, so a reload mid-show keeps the layout. per tab, like the
	// rest of the controls' working state
	const openAccordions = new PersistentState<Record<string, boolean>>(
		'openAccordions',
		{},
		'sessionStorage'
	);
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { slide } from '$lib/motion';

	type Props = {
		title: string;
		// shown after the title, muted, eg: what a closed section has set
		summary?: string;
		children: Snippet;
		defaultstate?: 'open' | 'closed';
		// what its open state is saved under; needed when the title changes, or isn't unique
		id?: string;
		// shown next to the title, outside the toggle button, eg: an automation's switch
		aside?: Snippet;
	};

	let { title, summary, children, defaultstate = 'open', id, aside }: Props = $props();

	const key = $derived(id ?? title);
	const open = $derived(openAccordions.current[key] ?? defaultstate === 'open');
</script>

<div class="relative w-full max-w-lg self-center">
	<div class="flex items-center gap-2">
		<button
			class="min-w-0 flex-1 text-left"
			aria-expanded={open}
			onclick={() => {
				openAccordions.current[key] = !open;
			}}
		>
			<span class="align-middle {open ? 'icon-[mdi--chevron-down]' : 'icon-[mdi--chevron-right]'}"
			></span>
			<span class="font-semibold">{title}</span>
			{#if summary}
				<span class="text-ctp-subtext0">{summary}</span>
			{/if}
		</button>
		{@render aside?.()}
	</div>
	{#if open}
		<!-- groups 12px apart; each Group spaces its own label and controls closer -->
		<div class="mt-1 mb-2 flex flex-col gap-3" transition:slide>
			{@render children()}
		</div>
	{/if}
	<hr class="hr" />
</div>
