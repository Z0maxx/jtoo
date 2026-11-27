<script lang="ts">
	import { settings } from '$lib/storage.svelte';
	import { type Settings } from '$lib/types.svelte';
	import { slide } from '$lib/motion';

	type Props = {
		desc: string;
		setting: keyof Settings;
		class?: string;
	};

	let { desc, setting, class: className = '' }: Props = $props();
</script>

<label transition:slide>
	<input
		class="peer size-4 accent-ctp-lavender {className}"
		type="checkbox"
		bind:checked={settings.current[setting] as boolean}
	/>
	<span class="peer-not-checked:text-ctp-overlay2">{desc}</span>
</label>
