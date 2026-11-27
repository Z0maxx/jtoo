<script lang="ts">
	import { settings } from '$lib/storage.svelte';
	import type { Settings } from '$lib/types.svelte';

	// a one-click switch for an automation setting, shown next to the controls it changes, so
	// it's clear when picks there can be changed back automatically

	type BooleanSetting = {
		[K in keyof Settings]-?: NonNullable<Settings[K]> extends boolean ? K : never;
	}[keyof Settings];

	type Props = {
		setting: BooleanSetting;
		label: string;
		// what the automation does, for the tooltip
		desc: string;
	};

	let { setting, label, desc }: Props = $props();

	const on = $derived(!!settings.current[setting]);
</script>

<button
	type="button"
	class="flex items-center gap-0.5 rounded-sm px-1 text-sm {on
		? 'bg-ctp-lavender/20 text-ctp-lavender hover:bg-ctp-lavender/35'
		: 'text-ctp-overlay2 hover:bg-ctp-text/10 hover:text-ctp-text'}"
	aria-pressed={on}
	title="{desc}: {on ? 'on' : 'off'}, click to turn {on ? 'off' : 'on'}"
	onclick={() => (settings.current[setting] = !on)}
>
	<!-- off is told apart by its icon as well as its colour -->
	<span class={on ? 'icon-[mdi--autorenew]' : 'icon-[mdi--autorenew-off]'} aria-hidden="true"
	></span>
	{label}
</button>
