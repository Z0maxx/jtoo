<script lang="ts">
	import { fundraisingState, settings } from '$lib/storage.svelte';
	import Milestones from './Milestones.svelte';
	import Overview from './Overview.svelte';
	import Donations from './Donations.svelte';
	import Rtd from './Rtd.svelte';

	//reset animation stage so animations don't play multiple times
	fundraisingState.current.animationStage = 0;
</script>

<div class="relative mx-4 my-2 h-full text-white">
	<Overview />
	<div class="mt-4 flex gap-4">
		<div class="w-2/4">
			<Milestones />
		</div>
		<div class="w-1/4">
			{#if settings.current.enableFundraisingRtd}
				<Rtd />
			{/if}
		</div>
		<div class="w-1/4">
			<Donations />
		</div>
	</div>
</div>

<style>
	:global(:root) {
		/*--restore-animation-after: 2s*/
		--restore-animation-after: 10s;
	}
</style>
