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
		? 'bg-ctp-lavender/25 text-ctp-lavender hover:bg-ctp-lavender/40'
		: 'text-ctp-text/50 line-through hover:bg-ctp-text/10 hover:text-ctp-text/80'}"
	aria-pressed={on}
	title="{desc}: {on ? 'on' : 'off'}, click to turn {on ? 'off' : 'on'}"
	onclick={() => (settings.current[setting] = !on)}
>
	<span class="icon-[mdi--autorenew]" aria-hidden="true"></span>
	{label}
</button>
