<script lang="ts">
	import { settings } from '$lib/storage.svelte';
	import type { Settings } from '$lib/types.svelte';

	// the settings a slider can drive: the ones that hold a number
	type NumberSetting = {
		[K in keyof Settings]: Settings[K] extends number ? K : never;
	}[keyof Settings];

	type Props = {
		setting: NumberSetting;
		min?: number;
		max: number;
		step?: number;
		// shown before the slider; the setting's name by default
		label?: string;
		// after the value; ° for hue and % otherwise by default
		unit?: string;
		// a muted line under the slider, saying what it's for
		help?: string;
		// the value is a box to type in as well, not only a readout
		editable?: boolean;
	};

	let {
		setting,
		min = 0,
		max,
		step = 1,
		label = setting,
		unit,
		help,
		editable = false
	}: Props = $props();

	// a typed value is kept within the slider's range; anything that isn't a number puts the
	// box back to the current value
	function onTyped(input: HTMLInputElement) {
		const typed = input.valueAsNumber;
		if (!Number.isNaN(typed)) settings.current[setting] = Math.min(max, Math.max(min, typed));
		input.value = String(settings.current[setting]);
	}

	const id = $props.id();
	const shownUnit = $derived(unit ?? (setting === 'hue' ? '°' : '%'));
</script>

<!-- the label's column fits its text on one line (88px at least, so the theme sliders line up),
     and the help line sits in the second column, under the value -->
<div class="grid w-fit grid-cols-[auto_auto] items-center gap-x-1">
	<label for={id} class="min-w-22 text-right whitespace-nowrap">{label}</label>
	<div class="flex items-center gap-1">
		{#if editable}
			<input
				type="number"
				class="remove-arrow w-14 input text-right"
				value={settings.current[setting]}
				{min}
				{max}
				{step}
				aria-label="{label}{unit ? ` in ${unit.trim()}` : ''}"
				onchange={(e) => onTyped(e.currentTarget)}
			/>
			<span>{shownUnit.trim()}</span>
		{:else}
			<!-- a fixed width, as wide as '200%', so sliders stacked in a column start in line -->
			<span class="w-11 text-right tabular-nums">{settings.current[setting]}{shownUnit}</span>
		{/if}
		<input
			{id}
			class="h-1 w-48 cursor-pointer appearance-none rounded-full bg-ctp-lavender/50 accent-ctp-lavender"
			type="range"
			bind:value={settings.current[setting]}
			{min}
			{max}
			{step}
			aria-describedby={help ? `${id}-help` : undefined}
		/>
	</div>
	{#if help}
		<p id="{id}-help" class="col-start-2 text-sm opacity-60">{help}</p>
	{/if}
</div>
