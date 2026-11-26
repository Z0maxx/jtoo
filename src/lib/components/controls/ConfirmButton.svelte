<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		onconfirm: () => void;
		class?: string;
		title?: string;
	};

	let { children, onconfirm, class: className = 'button-remove', title }: Props = $props();

	// how long the second click has to come within, before the button goes back to normal
	const CONFIRM_MS = 3000;

	// the first click only arms the button; the second, within CONFIRM_MS, runs the action.
	// for destructive actions that are one stray click away during a show
	let armed = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function disarm() {
		armed = false;
		clearTimeout(timer);
	}

	function onclick() {
		if (armed) {
			disarm();
			onconfirm();
			return;
		}
		armed = true;
		timer = setTimeout(disarm, CONFIRM_MS);
	}

	$effect(() => disarm);
</script>

<button
	class="{className} {armed ? 'text-ctp-red! underline' : ''}"
	{title}
	{onclick}
	onblur={disarm}
	aria-live="polite"
>
	{#if armed}
		click again to confirm
	{:else}
		{@render children()}
	{/if}
</button>
