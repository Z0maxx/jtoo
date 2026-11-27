<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		children: Snippet;
		state: 'open' | 'closed';
		container?: boolean;
		clearfn?: Function;
		onopen?: Function;
	};

	let {
		title,
		children,
		state = $bindable('closed'),
		container = true,
		clearfn,
		onopen
	}: Props = $props();

	function close() {
		state = 'closed';
		if (clearfn) clearfn();
	}
</script>

<section class={container ? 'relative' : ''}>
	<button
		class="button"
		onclick={() => {
			state = 'open';
			if (onopen) onopen();
		}}>{title}</button
	>
</section>
{#if state == 'open'}
	<!-- covers the screen and centres the panel in it, wherever the page is scrolled to. centred by
	     flex, not a transform, which would break fixed positioning inside the panel -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4
			pt-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
	>
		<button class="absolute inset-0" onclick={close} aria-label="popover backdrop"
			><div class="h-full w-full bg-black/20 backdrop-blur-md"></div></button
		>
		<!-- as tall as the screen allows, and scrolls inside itself past that. focused on open, so
		     escape closes it; handled here, not on the window, so it only closes the innermost one -->
		<div
			class="relative max-h-full w-full max-w-lg overflow-y-auto overscroll-contain border-2 bg-obs-content p-2 outline-none"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			tabindex="-1"
			{@attach (el) => el.focus({ preventScroll: true })}
			onkeydown={(e) => {
				if (e.key !== 'Escape') return;
				e.stopPropagation();
				close();
			}}
		>
			<button class="button-remove absolute top-0 right-2" onclick={close}>✖</button>
			<h1 class="text-center text-2xl">{title}</h1>
			<hr class="hr" />
			{@render children()}
		</div>
	</div>
{/if}
