<script lang="ts">
	import { items } from '$lib/storage.svelte';
	import type { Items } from '$lib/types.svelte';
	import { slide } from '$lib/motion';

	type Props = {
		placeholder: string;
		// the item lists that hold plain strings
		item: { [K in keyof Items]: Items[K] extends string[] ? K : never }[keyof Items];
		class?: string;
	};

	let { placeholder, item, class: className }: Props = $props();
</script>

<div transition:slide class={[className]}>
	<input
		class="input"
		{placeholder}
		onkeypress={(e) => {
			if (e.key === 'Enter') {
				const value = (e.target as HTMLInputElement).value;
				// if (item === 'flags' && value.length !== 2) return; // early return for flags
				(e.target as HTMLInputElement).value = '';
				if (items.current[item].includes(value)) return; // early return for dupes
				items.current[item].push(value);
			}
		}}
	/>
	<!-- <button
		class="button-remove"
		onclick={() => {
			items.current[item] = [''];
		}}>remove all</button
	> -->
</div>
