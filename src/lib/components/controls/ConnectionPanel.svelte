<script module lang="ts">
	import type { FeedState } from '$lib/websockets/console/console-live.svelte';

	// shared by every connection's status, here and in the controls' status bar
	export const feedStates: Record<FeedState, { state: string; color: string }> = {
		connecting: { state: 'connecting...', color: 'text-yellow-200' },
		open: { state: 'connected', color: 'text-green-300' },
		closed: { state: 'not connected', color: 'text-red-300' }
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Accordion from './Accordion.svelte';

	type Props = {
		// what the secret is called, e.g. 'token' or 'password'
		label: string;
		id: string;
		value: string;
		onconnect: () => void;
		state: FeedState;
		error?: string;
		// shown next to the status, e.g. that the data is a dummy
		note?: string;
		// anything else to show under the status, e.g. why the connection's dot is red
		children?: Snippet;
		// settings that rarely change, behind a closed accordion
		advanced?: Snippet;
	};

	let {
		label,
		id,
		value = $bindable(),
		onconnect,
		state,
		error,
		note,
		children,
		advanced
	}: Props = $props();
</script>

<!-- a form, so enter in the field connects -->
<form
	class="flex flex-col gap-1"
	onsubmit={(e) => {
		e.preventDefault();
		onconnect();
	}}
>
	<div class="flex items-center gap-2">
		<label for={id}>{label}:</label>
		<input type="password" class="input grow" {id} bind:value />
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<button class="button button-unselected hover:button-selected" type="submit">connect</button>
		<span>status:</span>
		<span class={feedStates[state].color}>{feedStates[state].state}</span>
		{#if note}
			<span class="text-ctp-yellow">({note})</span>
		{/if}
	</div>
	{#if error}
		<span class="text-red-300">{error}</span>
	{/if}
	{@render children?.()}
</form>
{#if advanced}
	<Accordion title="advanced settings" defaultstate="closed">
		{@render advanced()}
	</Accordion>
{/if}
