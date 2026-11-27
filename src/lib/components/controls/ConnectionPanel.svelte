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
		// what the field is called, e.g. 'token', 'password' or 'url'
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
		// the field is a password by default; eg: a url isn't secret
		type?: 'password' | 'text';
		placeholder?: string;
		// what the submit button says
		submitLabel?: string;
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
		advanced,
		type = 'password',
		placeholder,
		submitLabel = 'connect'
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
		<input {type} class="input grow" {id} {placeholder} bind:value />
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<button class="button hover:border-ctp-lavender-950 hover:bg-ctp-lavender hover:text-black" type="submit"
			>{submitLabel}</button
		>
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
	<!-- every connection has one, so it's saved under the connection's id -->
	<Accordion title="advanced settings" id="{id}-advanced" defaultstate="closed">
		{@render advanced()}
	</Accordion>
{/if}
