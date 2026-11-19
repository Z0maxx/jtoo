<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState } from '$lib/storage.svelte';
	import type { DonationMilestone } from '$lib/types.svelte';
	import { onDestroy } from 'svelte';

	let milestones: DonationMilestone[] = $state([
		{
			goal: 100,
			description: 'top 30 jumpers of all time stream with riot, matty and newjuls',
			isActive: false,
			isComplete: true
		},
		{
			goal: 250,
			description: 'LAN travel vlog ',
			isActive: true,
			isComplete: false
		},
		{
			goal: 500,
			description: 'Revive Jump Podcast',
			isActive: false,
			isComplete: false
		},
		{
			goal: 750,
			description: 'Replace soldier model with Medic model for rest of event',
			isActive: false,
			isComplete: false
		},
		{
			goal: 1000,
			description: 'Demos have to play soldier with sticky rockets for 1 map (during demo segment)',
			isActive: false,
			isComplete: false
		},
		{
			goal: 1250,
			description: 'roll the dice during demo segment',
			isActive: false,
			isComplete: false
		},
		{
			goal: 1500,
			description: 'roll the dice during beggars races',
			isActive: false,
			isComplete: false
		},
		{
			goal: 1750,
			description: 'Caster showmatch on 4dakids',
			isActive: false,
			isComplete: false
		},
		{
			goal: 2000,
			description: 'remove class restrictions for 6s vs jumpers (8 soldiers allowed)',
			isActive: false,
			isComplete: false
		},
		{
			goal: 3000,
			description: 'rtd enabled during 6v9',
			isActive: false,
			isComplete: false
		}
	]);

	const milestonesSubId = Dwb.subscribeToMilestones((newMilestones) => {
		milestones = newMilestones;
	});

	onDestroy(() => {
		Dwb.unsubscribeFromMilestones(milestonesSubId);
	});
</script>

<div class="duration-300 origin-top-right ease-in bg-emerald-950 border-2 border-emerald-900 rounded-md px-1 {fundraisingState.current.animationStage === 2 ? '-rotate-2' : ''} {fundraisingState.current.animationStage === 4 ? '-rotate-18' : ''}">
	<h2 class="text-xl">Milestones</h2>
	{#each milestones as milestone}
		<div class="flex gap-2">
			<div
				class="rounded-md {milestone.isComplete ? 'text-green-300' : ''} {milestone.isActive
					? 'text-amber-300'
					: ''}"
			>
				${milestone.goal}:
			</div>
			<div>{milestone.description}</div>
		</div>
	{/each}
</div>
