<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import { fundraisingState } from '$lib/storage.svelte';
	import type { DonationMilestone } from '$lib/types.svelte';
	import { onDestroy } from 'svelte';

	let milestones: DonationMilestone[] = $state([
    {
        "goal": 100,
        "description": "top 30 jumpers of all time stream with riot, matty and newjuls",
        "isComplete": true,
        "isActive": false
    },
    {
        "goal": 175,
        "description": "LAN travel vlog",
        "isComplete": false,
        "isActive": true
    },
    {
        "goal": 300,
        "description": "Revive Jump Podcast",
        "isComplete": false,
        "isActive": false
    },
    {
        "goal": 500,
        "description": "Showmatch stream after LAN",
        "isComplete": false,
        "isActive": false
    },
    {
        "goal": 750,
        "description": "Replace soldier model with Medic model for Day 1",
        "isComplete": false,
        "isActive": false
    },
    {
        "goal": 1000,
        "description": "Demos have to play soldier with sticky rockets on jump_starwars map (during demo segment)",
        "isComplete": false,
        "isActive": false
    },
    {
        "goal": 1250,
        "description": "roll the dice during demo segment enabled permanently",
        "isComplete": false,
        "isActive": false
    },
    {
        "goal": 1500,
        "description": "roll the dice during beggars races enabled permanently",
        "isComplete": false,
        "isActive": false
    },
    {
        "goal": 1750,
        "description": "Caster showmatch on 4dakids (rtd enabled)",
        "isComplete": false,
        "isActive": false
    },
    {
        "goal": 2000,
        "description": "rtd enabled during 6v9 last map permanently",
        "isComplete": false,
        "isActive": false
    },
    {
        "goal": 3000,
        "description": "Jump pugs 2027",
        "isComplete": false,
        "isActive": false
    },
    {
        "goal": 4000,
        "description": "Giveaway HAT and items",
        "isComplete": false,
        "isActive": false
    }
]);
	const milestonesSubId = Dwb.subscribeToMilestones((newMilestones) => {
		milestones = newMilestones;
	});

	onDestroy(() => {
		Dwb.unsubscribeFromMilestones(milestonesSubId);
	});
</script>

<div
	class="origin-top-right rounded-md border-2 border-emerald-900 bg-emerald-950 px-1
    {fundraisingState.current.stage === 4 ? 'milestones-animation' : ''}"
>
	<h2 class="text-xl">Milestones</h2>
	{#each milestones as milestone}
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
			rotate: -7.5deg;
		}
	}

	.milestones-animation {
		animation:
			milestones 900ms cubic-bezier(0.63, 2.06, 0, 0.14) forwards,
			milestones 300ms ease-out var(--restore-animation-after) reverse forwards;
	}
</style>
