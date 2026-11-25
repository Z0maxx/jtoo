<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState } from '$lib/storage.svelte';
	import type { DonationMilestone } from '$lib/types.svelte';
	import { onDestroy } from 'svelte';

	let milestones: DonationMilestone[] = $state([]);
	const milestonesSubId = Dwb.subscribeToMilestones((newMilestones) => {
		milestones = newMilestones;
	});

	onDestroy(() => {
		Dwb.unsubscribeFromMilestones(milestonesSubId);
	});
</script>

<div
	class="origin-top-right rounded-md border-2 bg-bordeaux px-1
    {fundraisingState.current.animationStage === 4 ? 'milestones-animation' : ''}"
>
	<h2 class="text-xl">Milestones</h2>
	{#each milestones as milestone, i (i)}
		<div class="flex gap-2">
			<div
				class="rounded-md
          {milestone.isComplete ? 'text-green-300' : ''}
          {milestone.isActive ? 'text-amber-300' : ''}"
			>
				${milestone.goal}:
			</div>
			<div>{milestone.description}</div>
		</div>
	{/each}
</div>

<style>
	@keyframes milestones {
		0% {
			rotate: 0deg;
		}

		100% {
			rotate: -11.5deg;
		}
	}

	.milestones-animation {
		animation:
			milestones 900ms cubic-bezier(0.63, 2.06, 0, 0.14) forwards,
			milestones 300ms ease-out var(--restore-animation-after) reverse forwards;
	}
</style>
