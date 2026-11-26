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

<!-- both labels share one grid cell, so the button is always as wide as the longer one and
     doesn't resize (and move out from under the pointer) when it arms or disarms -->
<button
	class="{className} inline-grid whitespace-nowrap {armed ? 'text-ctp-red! underline' : ''}"
	{title}
	{onclick}
	onblur={disarm}
	aria-live="polite"
>
	<span class="[grid-area:1/1] {armed ? 'invisible' : ''}" aria-hidden={armed}>
		{@render children()}
	</span>
	<span class="[grid-area:1/1] {armed ? '' : 'invisible'}" aria-hidden={!armed}>confirm?</span>
</button>
