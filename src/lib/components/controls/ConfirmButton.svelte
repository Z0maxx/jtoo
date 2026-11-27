<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		onconfirm: () => void;
		// 'link' is a text action, eg: reset to default; 'danger' an outlined button for the
		// actions that clear what's on air, eg: the timers
		variant?: 'link' | 'danger';
		title?: string;
	};

	let { children, onconfirm, variant = 'link', title }: Props = $props();

	const variants = {
		link: { base: 'button-remove', armed: 'text-ctp-red! underline' },
		danger: { base: 'button-danger', armed: 'bg-ctp-red! text-black! hover:bg-ctp-red!' }
	};

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
<!-- type="button": inside a form it would otherwise submit it -->
<button
	type="button"
	class="{variants[variant].base} inline-grid whitespace-nowrap {armed
		? variants[variant].armed
		: ''}"
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
