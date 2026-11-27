<script lang="ts">
	import _ from 'underscore';
	import { v4 as uuidv4 } from 'uuid';

	type Props = {
		opts: any[];
		labelkey?: string | string[];
		optlabels?: string[];
		value?: any;
		log?: boolean;
		onchange?: (value: any) => void;
		// every click, including on the option that's already selected
		onpick?: (value: any) => void;
		undefinedOption?: boolean;
	};
	let {
		opts,
		labelkey,
		optlabels,
		log = false,
		value = $bindable(),
		onchange,
		onpick,
		undefinedOption = false
	}: Props = $props();

	let name = uuidv4();

	function onSelect() {
		if (log) console.log(`${name}: ${value}`);

		if (onchange) onchange(value);
	}

	function getOptionLabel(opt: any, labelkey: string | string[] | undefined, index: number) {
		if (optlabels && index < optlabels.length) {
			return optlabels[index];
		}
		if (typeof labelkey == 'undefined') {
			return opt;
		}

		if (typeof labelkey == 'string' && labelkey in opt) {
			return opt[labelkey];
		}

		if (labelkey.constructor === Array) {
			const numKeys = labelkey.length;
			let optLabel = { ...opt };

			for (let i = 0; i < numKeys; i++) {
				if (!(labelkey[i] in optLabel)) {
					return opt;
				}
				optLabel = optLabel[labelkey[i]];

				if (i + 1 == numKeys) {
					return optLabel;
				}
			}
		}
	}
</script>

<div class="button-container">
	{#if undefinedOption}
		<label
			class="button button-option flex cursor-pointer flex-col select-none
                {typeof value == 'undefined' ? 'border-ctp-lavender-950 bg-ctp-lavender text-black hover:bg-ctp-lavender' : ''}"
		>
			<input
				type="radio"
				class="sr-only"
				{name}
				bind:group={value}
				value={undefined}
				onclick={() => onpick?.(undefined)}
				onchange={() => {
					onSelect();
				}}
			/>
			✖
		</label>
	{/if}
	{#each opts as opt, i (i)}
		{@render RadioButton(opt, i)}
	{/each}
</div>

{#snippet RadioButton(opt: any, index: number)}
	{@const optlabel = getOptionLabel(opt, labelkey, index)}
	<label
		class="button button-option flex cursor-pointer flex-col select-none
                {labelkey && _.isEqual(opt, value)
			? 'border-ctp-lavender-950 bg-ctp-lavender text-black hover:bg-ctp-lavender'
			: ''}"
	>
		<input
			type="radio"
			class="sr-only"
			{name}
			bind:group={value}
			value={opt}
			onclick={() => onpick?.(opt)}
			onchange={() => {
				onSelect();
			}}
		/>
		{optlabel === '' ? '✖' : optlabel}
	</label>
{/snippet}
