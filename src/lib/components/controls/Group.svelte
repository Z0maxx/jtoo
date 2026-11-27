<script lang="ts">
	import type { Snippet } from 'svelte';

	// a labelled group of controls, eg: the scene's options. the label sits close over its
	// controls; groups are spaced further apart by whatever holds them

	type Props = {
		label: string;
		children: Snippet;
		// on the label's row, at the end, eg: a refresh button or automation switches
		action?: Snippet;
	};

	let { label, children, action }: Props = $props();

	const id = $props.id();
</script>

<div class="flex flex-col gap-1" role="group" aria-labelledby={id}>
	<div class="flex min-h-6 flex-wrap items-center justify-between gap-x-2">
		<span class="label" {id}>{label}</span>
		{#if action}
			<div class="flex flex-wrap items-center gap-2">{@render action()}</div>
		{/if}
	</div>
	{@render children()}
</div>
