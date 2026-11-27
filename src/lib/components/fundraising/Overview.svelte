<script lang="ts">
	import { Dwb } from '$lib/api/dwb/api-dwb';
	import type { DonationsOverview } from '$lib/types.svelte';
	import { onDestroy } from 'svelte';
	import { fundraisingState } from '$lib/storage.svelte';
	import RocketProgressBar from './RocketProgressBar.svelte';

	/*fundraisingState.current.progressBar.raised = 0;
	fundraisingState.current.progressBar.sumRaised = 0;
	fundraisingState.current.stage = 0;
	fundraisingState.current.sumGoal = 0;*/
	let overview: DonationsOverview = $state({
		goal: 0,
		raised: 0,
		donationCount: 0
	});

	const overviewSubId = Dwb.subscribeToDonationsOverview((newOverview) => {
		overview = newOverview;
	});

	onDestroy(() => {
		Dwb.unsubscribeFromDonationsOverview(overviewSubId);
	});
</script>

<div
	class="relative z-10 origin-bottom-left
    {fundraisingState.current.animationStage === 1 ? 'progress-bar-animation-1' : ''}
    {fundraisingState.current.animationStage === 6 ? 'progress-bar-animation-2' : ''}"
>
	<div class="flex justify-between text-3xl">
		<span
			class="origin-bottom-right
        {fundraisingState.current.animationStage === 2 ? 'raised-animation' : ''}"
			>${overview.raised} Raised</span
		>
		<span>{overview.donationCount} Donations</span>
		<span class={fundraisingState.current.animationStage === 5 ? 'goal-animation' : ''}
			>${fundraisingState.current.sumGoal} Goal</span
		>
	</div>
	<RocketProgressBar {overview} />
</div>

<style>
	:root {
		--progress-bar-1-1-time: 400ms;
		--progress-bar-2-time: 400ms;
	}

	@keyframes progress-bar-1-1 {
		to {
			rotate: -8deg;
		}
	}

	@keyframes progress-bar-1-2 {
		from {
			rotate: -8deg;
		}

		to {
			rotate: 30.8deg;
		}
	}

	@keyframes progress-bar-restore-1 {
		from {
			rotate: 30.8deg;
		}

		to {
			rotate: 0deg;
		}
	}

	@keyframes progress-bar-2 {
		from {
			transform: translateX(0);
		}

		33% {
			transform: translateX(calc(var(--spacing) * 2));
		}

		66% {
			transform: translateX(0);
		}

		to {
			transform: translateX(calc(var(--spacing) * -2));
		}
	}

	@keyframes progress-bar-restore-2 {
		from {
			transform: translateX(calc(var(--spacing) * -2));
		}

		to {
			transform: translateX(0);
		}
	}

	@keyframes raised {
		from {
			transform: translateY(0);
			rotate: 0deg;
		}

		to {
			transform: translateY(1em);
			rotate: 180deg;
		}
	}

	@keyframes goal {
		from {
			transform: rotateY(0deg);
		}

		to {
			transform: rotateY(180deg);
		}
	}

	.progress-bar-animation-1 {
		animation:
			progress-bar-1-1 var(--progress-bar-1-1-time) ease-out forwards,
			progress-bar-1-2 800ms cubic-bezier(0.55, 1.7, 0, 0.63) var(--progress-bar-1-1-time) forwards,
			progress-bar-restore-1 300ms ease-out var(--restore-animation-after) forwards;
	}

	.progress-bar-animation-2 {
		animation:
			progress-bar-2 var(--progress-bar-2-time) linear forwards,
			progress-bar-restore-2 300ms ease-out var(--restore-animation-after) forwards;
	}

	.raised-animation {
		animation:
			raised 1000ms cubic-bezier(0.63, 2.06, 0, 0.14) forwards,
			raised 300ms ease-out var(--restore-animation-after) reverse forwards;
	}

	.goal-animation {
		animation:
			goal 1000ms cubic-bezier(0.63, 2.06, 0, 0.14) forwards,
			goal 300ms ease-out var(--restore-animation-after) reverse forwards;
	}
</style>
